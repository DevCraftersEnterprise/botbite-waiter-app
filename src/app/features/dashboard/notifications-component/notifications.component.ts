import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { Check, LucideAngularModule, LucideIconData, RotateCcw } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { IconsService } from '../../../core/services/icons.service';
import { OrgService } from '../../../core/services/org.service';
import {
  CashierNotification,
  NotificationType,
  SocketService,
} from '../../../core/services/socket.service';
import { TitleComponent } from '../../../shared/components/title/title';
import { OrdersService } from '../../../core/services/orders.service';

@Component({
  selector: 'app-notifications-component',
  imports: [CommonModule, LucideAngularModule, TitleComponent],
  templateUrl: './notifications.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsComponent implements OnDestroy {
  protected readonly orgService = inject(OrgService);
  private readonly ordersService = inject(OrdersService);
  private readonly toastrService = inject(ToastrService);
  private readonly socketService = inject(SocketService);
  private readonly iconsService = inject(IconsService);

  private notificationSubscription?: Subscription;

  /** Qué se ve en cada tipo de aviso. */
  protected readonly types: Record<NotificationType, { label: string; icon: LucideIconData }> = {
    order: { label: 'Comanda', icon: this.iconsService.orders },
    bill: { label: 'Cuenta', icon: this.iconsService.bill },
    pay_with_waiter: { label: 'Paga con mesero', icon: this.iconsService.cash },
    payment: { label: 'Pago', icon: this.iconsService.card },
    alert: { label: 'Alerta', icon: this.iconsService.alert },
    invoice: { label: 'Factura', icon: this.iconsService.invoice },
  };
  protected readonly typeOptions = Object.entries(this.types).map(([value, { label }]) => ({
    value,
    label,
  }));
  protected readonly typeFilter = signal<string>('');

  activeNotifications = signal<CashierNotification[]>([]);
  inactiveNotifications = signal<CashierNotification[]>([]);
  isLoading = signal<boolean>(true);

  protected readonly visibleActive = computed(() => this.applyFilter(this.activeNotifications()));
  protected readonly visibleInactive = computed(() =>
    this.applyFilter(this.inactiveNotifications())
  );

  readonly checkIcon = Check;
  readonly rotateCcwIcon = RotateCcw;

  constructor() {
    this.notificationSubscription = this.socketService
      .getNotificationUpdates()
      .subscribe((update) => {
        this.handleNotificationUpdate(update.notification);
      });

    // La sucursal puede resolverse después de abrir la pantalla (al recargar) o
    // cambiar mientras está abierta.
    effect(() => {
      const branchId = this.orgService.selectedBranchId();

      if (!branchId) {
        this.activeNotifications.set([]);
        this.inactiveNotifications.set([]);
        this.isLoading.set(this.orgService.loadingBranches());
        return;
      }

      this.loadNotifications(branchId);
      this.socketService.joinBranch(branchId);
    });
  }

  private applyFilter(notifications: CashierNotification[]): CashierNotification[] {
    const type = this.typeFilter();
    return type ? notifications.filter((n) => n.type === type) : notifications;
  }

  protected updateTypeFilter(event: Event): void {
    this.typeFilter.set((event.target as HTMLSelectElement).value);
  }

  /** Avisa con un tono: caja no siempre está viendo la pantalla. */
  private playAlert(): void {
    try {
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.frequency.value = 880;
      gain.gain.value = 0.05;
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.2);
      oscillator.onended = () => void audio.close();
    } catch {
      // El navegador puede bloquear el audio hasta que el usuario interactúe.
    }
  }

  private loadNotifications(branchId: string): void {
    this.isLoading.set(true);
    this.ordersService.getNotificationsByBranch(branchId).subscribe({
      next: (data: { active: CashierNotification[]; inactive: CashierNotification[] }) => {
        this.activeNotifications.set(data.active);
        this.inactiveNotifications.set(data.inactive);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading notifications:', error);
        this.toastrService.error('Error al cargar las notificaciones.');
        this.isLoading.set(false);
      }
    });
  }

  private handleNotificationUpdate(notification: CashierNotification): void {
    if (notification.isActive) {
      const activeList = this.activeNotifications();
      const index = activeList.findIndex(n => n.id === notification.id);

      if (index >= 0) {
        const updated = [...activeList];
        updated[index] = notification;
        this.activeNotifications.set(updated);
      } else {
        this.activeNotifications.set([notification, ...activeList]);
        this.toastrService.info(notification.message, 'Nueva notificación');
        this.playAlert();
      }

      this.removeFromInactive(notification.id);
    } else {
      const inactiveList = this.inactiveNotifications();
      const index = inactiveList.findIndex(n => n.id === notification.id);

      if (index >= 0) {
        const updated = [...inactiveList];
        updated[index] = notification;
        this.inactiveNotifications.set(updated);
      } else {
        this.inactiveNotifications.set([notification, ...inactiveList]);
      }

      this.removeFromActive(notification.id);
    }
  }

  private removeFromActive(notificationId: string): void {
    const updated = this.activeNotifications().filter(n => n.id !== notificationId);
    this.activeNotifications.set(updated);
  }

  private removeFromInactive(notificationId: string): void {
    const updated = this.inactiveNotifications().filter(n => n.id !== notificationId);
    this.inactiveNotifications.set(updated);
  }

  markAsRead(notification: CashierNotification): void {
    if (!notification.isActive) return;

    const updated = { ...notification, isActive: false };
    this.handleNotificationUpdate(updated);

    this.ordersService.markNotificationAsRead(notification.id).subscribe({
      error: () => {
        this.handleNotificationUpdate(notification);
        this.toastrService.error('Error al marcar la notificación como leída.');
      }
    });
  }

  markAsUnread(notification: CashierNotification): void {
    if (notification.isActive) return;

    const updated = { ...notification, isActive: true };
    this.handleNotificationUpdate(updated);

    this.ordersService.markNotificationAsUnread(notification.id).subscribe({
      error: () => {
        this.handleNotificationUpdate(notification);
        this.toastrService.error('Error al marcar la notificación como no leída.');
      }
    });
  }

  ngOnDestroy(): void {
    const branchId = this.orgService.selectedBranchId();
    if (branchId) {
      this.socketService.leaveBranch(branchId);
    }
    this.notificationSubscription?.unsubscribe();
  }
}