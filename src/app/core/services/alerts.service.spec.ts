import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { Observable, of, Subject } from 'rxjs';
import { AlertSoundService } from './alert-sound.service';
import {
  AlertsService,
  NOTIFICATION_BEEP_DELAY_MS,
  ORDER_REPEAT_MS,
  TICK_MS,
  TITLE_BLINK_MS,
} from './alerts.service';
import { BotService } from './bot.service';
import { OrdersService } from './orders.service';
import { OrgService } from './org.service';
import { CashierNotification, NotificationUpdate, SocketService } from './socket.service';
import type { DeliveryOrder } from './types/orders.type';

describe('AlertsService', () => {
  const start = new Date('2026-11-10T18:00:00Z');
  const minutes = (n: number) => n * 60_000;

  let notifications$: Subject<NotificationUpdate>;
  let orderUpdates$: Subject<{ branchId: string }>;
  let resyncs$: Subject<void>;
  let socket: { joinBranch: jasmine.Spy };
  let ordersService: { getNotificationsByBranch: jasmine.Spy; toDeliver: jasmine.Spy };
  let botService: { getOrdering: jasmine.Spy };
  let sound: { start: jasmine.Spy; stop: jasmine.Spy; play: jasmine.Spy };
  let toastr: { info: jasmine.Spy };
  let branchId: ReturnType<typeof signal<string | null>>;
  let alerts: AlertsService;
  let title: Title;

  const notification = (
    id: string,
    { isActive = true, reopened = false }: { isActive?: boolean; reopened?: boolean } = {}
  ): CashierNotification => {
    const createdAt = new Date(Date.now() - (reopened ? minutes(10) : 0));
    return {
      id,
      type: 'order',
      message: `Aviso ${id}`,
      isActive,
      createdAt,
      updatedAt: new Date(Date.now()),
    };
  };

  const order = (
    id: string,
    fulfillmentStatus: DeliveryOrder['fulfillmentStatus'] = 'pending',
    scheduledFor: string | null = null
  ) => ({ id, fulfillmentStatus, scheduledFor }) as DeliveryOrder;

  const ordering = (enabled = true) =>
    of({ enabled, scheduling: { reminderMinutes: 30 } } as never) as Observable<never>;

  const orderSounds = () => sound.play.calls.allArgs().filter(([kind]) => kind === 'order').length;
  const beeps = () => sound.play.calls.allArgs().filter(([kind]) => kind === 'notification').length;

  /** Avanza el reloj y corre los efectos (el título). */
  const advance = (ms: number) => {
    jasmine.clock().tick(ms);
    TestBed.tick();
  };

  const open = (orders: DeliveryOrder[] = [], active: CashierNotification[] = []) => {
    ordersService.toDeliver.and.returnValue(of(orders));
    ordersService.getNotificationsByBranch.and.returnValue(of({ active, inactive: [] }));
    alerts.start();
    TestBed.tick();
  };

  /** El bot cambia los pedidos y la API avisa por el socket. */
  const ordersChange = (orders: DeliveryOrder[]) => {
    ordersService.toDeliver.and.returnValue(of(orders));
    orderUpdates$.next({ branchId: 'b1' });
    advance(300);
  };

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(start);

    notifications$ = new Subject();
    orderUpdates$ = new Subject();
    resyncs$ = new Subject();
    socket = { joinBranch: jasmine.createSpy('joinBranch') };
    ordersService = {
      getNotificationsByBranch: jasmine.createSpy('getNotificationsByBranch'),
      toDeliver: jasmine.createSpy('toDeliver'),
    };
    botService = { getOrdering: jasmine.createSpy('getOrdering').and.returnValue(ordering()) };
    sound = {
      start: jasmine.createSpy('start'),
      stop: jasmine.createSpy('stop'),
      play: jasmine.createSpy('play').and.returnValue(true),
    };
    toastr = { info: jasmine.createSpy('info') };
    branchId = signal<string | null>('b1');

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: SocketService,
          useValue: {
            ...socket,
            getNotificationUpdates: () => notifications$,
            getOrderUpdates: () => orderUpdates$,
            getResyncs: () => resyncs$,
          },
        },
        { provide: OrdersService, useValue: ordersService },
        { provide: BotService, useValue: botService },
        { provide: OrgService, useValue: { selectedBranchId: branchId } },
        { provide: AlertSoundService, useValue: sound },
        { provide: ToastrService, useValue: toastr },
      ],
    });
    alerts = TestBed.inject(AlertsService);
    title = TestBed.inject(Title);
    title.setTitle('BotBite - Panel');
  });

  afterEach(() => {
    alerts.stop();
    jasmine.clock().uninstall();
  });

  it('counts unread notifications and paid orders of the selected branch (decision 5)', () => {
    open([order('o1'), order('o2', 'preparing')], [notification('n1'), notification('n2')]);

    expect(socket.joinBranch).toHaveBeenCalledWith('b1');
    expect(alerts.unread()).toBe(2);
    expect(alerts.paid()).toBe(1);
    expect(alerts.hasBadges()).toBeTrue();
    expect(title.getTitle()).toBe('(2) BotBite');
  });

  it('shows no "Para entregar" number when the branch has no ordering', () => {
    botService.getOrdering.and.returnValue(ordering(false));
    open([order('o1')]);

    expect(alerts.paid()).toBe(0);
    expect(ordersService.toDeliver).not.toHaveBeenCalled();
    expect(title.getTitle()).toBe('BotBite');
  });

  it('announces a new notification on any screen, but not one marked unread again', () => {
    open([], [notification('n1')]);

    notifications$.next({ branchId: 'b1', notification: notification('n2') });
    expect(toastr.info).toHaveBeenCalledOnceWith('Aviso n2', 'Nueva notificación');
    expect(alerts.unread()).toBe(2);
    advance(NOTIFICATION_BEEP_DELAY_MS);
    expect(beeps()).toBe(1);

    notifications$.next({ branchId: 'b1', notification: notification('n1', { isActive: false }) });
    notifications$.next({ branchId: 'b1', notification: notification('n1', { reopened: true }) });
    advance(NOTIFICATION_BEEP_DELAY_MS);
    expect(toastr.info).toHaveBeenCalledTimes(1);
    expect(beeps()).toBe(1);

    notifications$.next({ branchId: 'other', notification: notification('n9') });
    expect(alerts.unread()).toBe(2);
  });

  it('plays the order sound for a new paid order instead of the notification beep', () => {
    open();

    notifications$.next({ branchId: 'b1', notification: notification('n1') });
    ordersChange([order('o1')]);
    advance(NOTIFICATION_BEEP_DELAY_MS);

    expect(orderSounds()).toBe(1);
    expect(beeps()).toBe(0);
  });

  it('repeats every 30 seconds while the order stays paid and stops when caja moves it (decision 7)', () => {
    open();
    ordersChange([order('o1')]);
    expect(orderSounds()).toBe(1);

    advance(ORDER_REPEAT_MS - TICK_MS);
    expect(orderSounds()).toBe(1);
    advance(TICK_MS);
    expect(orderSounds()).toBe(2);

    ordersChange([order('o1', 'preparing')]);
    advance(ORDER_REPEAT_MS * 3);
    expect(orderSounds()).toBe(2);
    expect(alerts.paid()).toBe(0);
  });

  it('keeps reminding about paid orders that were already there when the panel opened', () => {
    open([order('o1')]);
    expect(orderSounds()).toBe(0);

    advance(TICK_MS);
    expect(orderSounds()).toBe(1);
  });

  it('sounds a scheduled order when paid and repeats it from reminderMinutes before its time', () => {
    open();
    const at = new Date(start.getTime() + minutes(120)).toISOString();
    ordersChange([order('o1', 'pending', at)]);
    expect(orderSounds()).toBe(1);

    advance(minutes(60));
    expect(orderSounds()).toBe(1);

    // 30 minutos antes de su hora empieza a repetirse.
    advance(minutes(31));
    expect(orderSounds()).toBeGreaterThan(1);
  });

  it('alternates the title with "¡Pedido nuevo!" while the tab is hidden (decision 6)', () => {
    const hidden = spyOnProperty(document, 'hidden').and.returnValue(false);
    open([order('o1')], [notification('n1')]);

    hidden.and.returnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    const titles = new Set<string>();
    for (let i = 0; i < 3; i += 1) {
      advance(TITLE_BLINK_MS);
      titles.add(title.getTitle());
    }
    expect([...titles].sort()).toEqual(['(1) BotBite', '¡Pedido nuevo!']);

    hidden.and.returnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    advance(TITLE_BLINK_MS);
    advance(TITLE_BLINK_MS);
    expect(title.getTitle()).toBe('(1) BotBite');
  });

  it('reloads the unread count when the live connection comes back', () => {
    open([], [notification('n1')]);

    ordersService.getNotificationsByBranch.and.returnValue(
      of({ active: [notification('n1'), notification('n2')], inactive: [] })
    );
    resyncs$.next();

    expect(alerts.unread()).toBe(2);
  });

  it('restores the page title when it stops', () => {
    open([], [notification('n1')]);

    alerts.stop();

    expect(title.getTitle()).toBe('BotBite - Panel');
    expect(sound.stop).toHaveBeenCalled();
  });
});
