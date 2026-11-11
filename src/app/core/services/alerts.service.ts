import { DOCUMENT } from '@angular/common';
import {
  computed,
  effect,
  EffectRef,
  inject,
  Injectable,
  Injector,
  signal,
  untracked,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, Subscription } from 'rxjs';
import { AlertSoundService } from './alert-sound.service';
import { BotService } from './bot.service';
import { OrdersService } from './orders.service';
import { OrgService } from './org.service';
import { CashierNotification, NotificationUpdate, SocketService } from './socket.service';
import type { DeliveryOrder } from './types/orders.type';

/** Un pedido que sigue en "Pagado" vuelve a sonar cada 30 segundos (decisión 7). */
export const ORDER_REPEAT_MS = 30_000;

/** Cada cuánto se revisa si hay pedidos por atender sin sonido en curso (los que ya estaban o un programado que llegó a su aviso). */
export const TICK_MS = 5_000;

/**
 * Un pedido pagado también llega como aviso de Notificaciones. El tono del
 * aviso espera un poco: si en ese tiempo suena el del pedido, ya no hace falta.
 */
export const NOTIFICATION_BEEP_DELAY_MS = 1_500;

/** Con la pestaña oculta y un pedido por atender, el título cambia cada segundo. */
export const TITLE_BLINK_MS = 1_000;

const TITLE = 'BotBite';
const NEW_ORDER_TITLE = '¡Pedido nuevo!';

/** Las pantallas recargan con la misma pausa cuando llegan varios avisos juntos. */
const RELOAD_DEBOUNCE_MS = 300;

/** Un aviso nuevo se crea con las dos fechas iguales; uno que vuelve a "no leído", no. */
const isBrandNew = (notification: CashierNotification): boolean =>
  Math.abs(
    new Date(notification.updatedAt).getTime() - new Date(notification.createdAt).getTime()
  ) < 1_000;

/**
 * Los avisos de todo el panel (decisiones 5 a 8): los numeritos del menú, el
 * título de la pestaña y los sonidos, en cualquier pantalla. Son de la
 * sucursal elegida arriba. Lo arranca el layout del panel.
 */
@Injectable({ providedIn: 'root' })
export class AlertsService {
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly toastr = inject(ToastrService);
  private readonly socket = inject(SocketService);
  private readonly ordersService = inject(OrdersService);
  private readonly botService = inject(BotService);
  private readonly orgService = inject(OrgService);
  private readonly sound = inject(AlertSoundService);

  private readonly unreadIds = signal<ReadonlySet<string>>(new Set());
  /** null: la sucursal no tiene pedidos activos. */
  private readonly paidOrders = signal<DeliveryOrder[] | null>(null);
  private readonly now = signal(Date.now());

  /** Avisos sin leer: el numerito de Notificaciones y el título. */
  readonly unread = computed(() => this.unreadIds().size);
  /** Pedidos en "Pagado" (nuevos, sin empezar): el numerito de "Para entregar". */
  readonly paid = computed(() => this.paidOrders()?.length ?? 0);
  /**
   * Pedidos que hay que atender ya: los de "Pagado", menos los programados que
   * todavía no llegan a su aviso (`reminderMinutes` antes de la hora).
   */
  readonly toAttend = computed(() => {
    const now = this.now();
    const reminderMs = this.reminderMinutes() * 60_000;
    return (this.paidOrders() ?? []).filter(
      (order) => !order.scheduledFor || new Date(order.scheduledFor).getTime() - reminderMs <= now
    ).length;
  });
  /** Para el punto rojo del botón del menú en el celular. */
  readonly hasBadges = computed(() => this.unread() > 0 || this.paid() > 0);

  private readonly reminderMinutes = signal(30);
  private readonly hidden = signal(false);
  private readonly blinkOn = signal(false);

  private branchId: string | null = null;
  /** Pedidos que ya se vieron en "Pagado": solo suena el que llega nuevo. */
  private knownPaid = new Set<string>();
  /** La primera carga de la sucursal: lo que ya estaba no es nuevo. */
  private ordersLoaded = false;
  /** Avisos que ya se vieron: volver a "no leído" no es un aviso nuevo. */
  private seenNotifications = new Set<string>();
  /** La siguiente repetición del sonido de pedido. */
  private repeatTimer: ReturnType<typeof setTimeout> | null = null;

  private started = false;
  private subscriptions: Subscription[] = [];
  private effects: EffectRef[] = [];
  private timers: ReturnType<typeof setInterval>[] = [];
  private pendingBeep: ReturnType<typeof setTimeout> | null = null;
  private originalTitle = '';

  start(): void {
    if (this.started) return;
    this.started = true;
    this.originalTitle = this.title.getTitle();
    this.sound.start();

    this.subscriptions = [
      this.socket.getNotificationUpdates().subscribe((update) => this.onNotification(update)),
      // También al volver la conexión en vivo y cada 30 s sin ella.
      this.socket
        .getOrderUpdates()
        .pipe(debounceTime(RELOAD_DEBOUNCE_MS))
        .subscribe(() => this.loadOrders()),
      this.socket.getResyncs().subscribe(() => this.loadNotifications()),
    ];

    this.effects = [
      effect(
        () => {
          const branchId = this.orgService.selectedBranchId();
          untracked(() => this.switchBranch(branchId));
        },
        { injector: this.injector }
      ),
      effect(() => this.title.setTitle(this.currentTitle()), { injector: this.injector }),
    ];

    this.hidden.set(this.document.hidden);
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.timers = [
      setInterval(() => this.tick(), TICK_MS),
      setInterval(() => this.blinkOn.update((on) => !on), TITLE_BLINK_MS),
    ];
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.effects.forEach((ref) => ref.destroy());
    this.timers.forEach((timer) => clearInterval(timer));
    if (this.pendingBeep) clearTimeout(this.pendingBeep);
    this.subscriptions = [];
    this.effects = [];
    this.timers = [];
    this.pendingBeep = null;
    this.stopRepeating();

    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.sound.stop();
    this.switchBranch(null);
    this.title.setTitle(this.originalTitle);
  }

  /** "(N) BotBite", y "¡Pedido nuevo!" de forma alterna si no se está viendo la pestaña. */
  private currentTitle(): string {
    const unread = this.unread();
    const base = unread > 0 ? `(${unread}) ${TITLE}` : TITLE;
    const blink = this.hidden() && this.toAttend() > 0 && this.blinkOn();
    return blink ? NEW_ORDER_TITLE : base;
  }

  private switchBranch(branchId: string | null): void {
    this.branchId = branchId;
    this.unreadIds.set(new Set());
    this.paidOrders.set(null);
    this.knownPaid = new Set();
    this.ordersLoaded = false;
    this.seenNotifications = new Set();
    this.stopRepeating();

    if (!branchId) return;

    this.socket.joinBranch(branchId);
    this.loadNotifications();
    this.botService.getOrdering(branchId).subscribe({
      next: (ordering) => {
        if (this.branchId !== branchId) return;
        if (!ordering?.enabled) return;

        this.reminderMinutes.set(ordering.scheduling?.reminderMinutes ?? 30);
        this.paidOrders.set([]);
        this.loadOrders();
      },
      // Sin pedidos o sin permiso: no hay numerito de "Para entregar".
      error: () => undefined,
    });
  }

  private loadNotifications(): void {
    const branchId = this.branchId;
    if (!branchId) return;

    this.ordersService.getNotificationsByBranch(branchId).subscribe({
      next: ({ active, inactive }) => {
        if (this.branchId !== branchId) return;
        [...active, ...inactive].forEach((n) => this.seenNotifications.add(n.id));
        this.unreadIds.set(new Set(active.map((n) => n.id)));
      },
      // Notificaciones muestra su propio error.
      error: () => undefined,
    });
  }

  private loadOrders(): void {
    const branchId = this.branchId;
    if (!branchId || this.paidOrders() === null) return;

    this.ordersService.toDeliver(branchId).subscribe({
      next: (orders) => {
        if (this.branchId !== branchId) return;

        const paid = orders.filter((order) => order.fulfillmentStatus === 'pending');
        const firstLoad = !this.ordersLoaded;
        this.ordersLoaded = true;
        const arrived = paid.filter((order) => !this.knownPaid.has(order.id));
        paid.forEach((order) => this.knownPaid.add(order.id));
        this.paidOrders.set(paid);

        // Lo que ya estaba al abrir el panel no es nuevo: lo repite `tick`.
        if (arrived.length > 0 && !firstLoad) this.playOrderSound();
      },
      error: () => undefined,
    });
  }

  private onNotification({ branchId, notification }: NotificationUpdate): void {
    if (branchId !== this.branchId) return;

    const unread = new Set(this.unreadIds());
    const isNew = !this.seenNotifications.has(notification.id) && isBrandNew(notification);
    this.seenNotifications.add(notification.id);

    if (notification.isActive) unread.add(notification.id);
    else unread.delete(notification.id);
    this.unreadIds.set(unread);

    if (notification.isActive && isNew) {
      this.toastr.info(notification.message, 'Nueva notificación');
      this.scheduleBeep();
    }
  }

  private scheduleBeep(): void {
    if (this.pendingBeep) return;
    this.pendingBeep = setTimeout(() => {
      this.pendingBeep = null;
      this.sound.play('notification');
    }, NOTIFICATION_BEEP_DELAY_MS);
  }

  /** Suena y, si en 30 segundos sigue habiendo pedidos por atender, vuelve a sonar. */
  private playOrderSound(): void {
    if (this.pendingBeep) clearTimeout(this.pendingBeep);
    this.pendingBeep = null;
    this.sound.play('order');

    this.stopRepeating();
    this.repeatTimer = setTimeout(() => {
      this.repeatTimer = null;
      this.now.set(Date.now());
      if (this.toAttend() > 0) this.playOrderSound();
    }, ORDER_REPEAT_MS);
  }

  private stopRepeating(): void {
    if (this.repeatTimer) clearTimeout(this.repeatTimer);
    this.repeatTimer = null;
  }

  /** Empieza a repetir si hay pedidos por atender y no hay un sonido en curso. */
  private tick(): void {
    this.now.set(Date.now());
    if (this.toAttend() > 0 && !this.repeatTimer) this.playOrderSound();
  }

  private readonly onVisibilityChange = () => this.hidden.set(this.document.hidden);
}
