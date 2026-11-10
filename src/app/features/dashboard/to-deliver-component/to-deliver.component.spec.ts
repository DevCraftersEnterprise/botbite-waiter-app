import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { OrgService } from '../../../core/services/org.service';
import { SocketService } from '../../../core/services/socket.service';
import { DeliveryOrder } from '../../../core/services/types/orders.type';
import { ToDeliverComponent } from './to-deliver.component';

describe('ToDeliverComponent', () => {
  const api = environment.apiBaseUrl;
  const listUrl = `${api}/orders/to-deliver`;
  const orderingUrl = `${api}/branches/r1/b1/ordering`;
  let fixture: ComponentFixture<ToDeliverComponent>;
  let backend: HttpTestingController;
  let toastr: jasmine.SpyObj<ToastrService>;
  const updates = new Subject<{ branchId: string }>();

  const order = (overrides: Partial<DeliveryOrder> = {}): DeliveryOrder => ({
    id: 'o1',
    code: 'PED-0001',
    source: 'whatsapp',
    status: 'paid',
    table: null,
    customerName: 'Ana',
    language: 'es',
    locationVerified: false,
    openedAt: '2026-11-09T18:00:00Z',
    billRequestedAt: null,
    closedAt: '2026-11-09T18:05:00Z',
    subtotal: 300,
    walletDiscount: 20,
    total: 280,
    tip: 0,
    amountDue: 322,
    paymentMethod: 'mercado_pago',
    rounds: [
      {
        id: 'r1',
        number: 1,
        status: 'new',
        sentAt: '2026-11-09T18:00:00Z',
        acknowledgedAt: null,
        deliveredAt: null,
        items: [
          {
            id: 'i1',
            menuItemId: 'm1',
            name: 'TACO',
            category: 'TACOS',
            quantity: 2,
            price: 150,
            note: 'sin cebolla',
          },
        ],
      },
    ],
    type: 'delivery',
    fulfillmentStatus: 'pending',
    fulfillmentUpdatedAt: '2026-11-09T18:05:00Z',
    scheduledFor: null,
    deliveryFee: 42,
    delivery: {
      address: 'Calle 5 de Febrero 123',
      references: 'Portón negro',
      latitude: 27.4912,
      longitude: -109.9381,
    },
    phone: '+5215533330001',
    ...overrides,
  });

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const button = (label: string) =>
    [...element().querySelectorAll('button')].find((b) => b.textContent?.trim() === label);

  const answer = async (
    orders: DeliveryOrder[],
    ordering: object | null = { enabled: true, accepting: true }
  ) => {
    backend.expectOne((r) => r.url === listUrl).flush({ orders, total: orders.length });
    backend.expectOne(orderingUrl).flush({ ordering });
    await fixture.whenStable();
  };

  beforeEach(async () => {
    toastr = jasmine.createSpyObj<ToastrService>('ToastrService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [ToDeliverComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastrService, useValue: toastr },
        {
          provide: OrgService,
          useValue: {
            selectedBranchId: signal('b1'),
            selectedRestaurantId: () => 'r1',
            loadingBranches: signal(false),
          },
        },
        {
          provide: SocketService,
          useValue: {
            getOrderUpdates: () => updates.asObservable(),
            joinBranch: jasmine.createSpy('joinBranch'),
          },
        },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ToDeliverComponent);
    await fixture.whenStable();
  });

  afterEach(() => backend.verify());

  it('shows each paid order with what to deliver and where', async () => {
    await answer([order()]);

    expect(text()).toContain('A domicilio · Ana');
    expect(text()).toContain('2x TACO');
    expect(text()).toContain('sin cebolla');
    expect(text()).toContain('Calle 5 de Febrero 123');
    expect(text()).toContain('Portón negro');
    expect(text()).toContain('$322.00');
    expect(text()).toContain('Recibiendo pedidos');
    const map = element().querySelector('a[href*="google.com/maps"]') as HTMLAnchorElement;
    expect(map.href).toContain('27.4912,-109.9381');
    const call = element().querySelector('a[href^="tel:"]') as HTMLAnchorElement;
    expect(call.getAttribute('href')).toBe('tel:+5215533330001');
  });

  it('moves an order with the same buttons as in WhatsApp', async () => {
    await answer([order()]);

    button('Va en camino')!.click();
    const request = backend.expectOne(`${api}/orders/o1/fulfillment`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'on_the_way' });
    request.flush({});
    await fixture.whenStable();

    backend.expectOne((r) => r.url === listUrl).flush({ orders: [], total: 0 });
    await fixture.whenStable();
    expect(text()).toContain('No hay pedidos por entregar');
  });

  it('marks scheduled orders and offers "Ya está listo" for pickup', async () => {
    await answer([
      order({
        type: 'pickup',
        delivery: null,
        deliveryFee: 0,
        fulfillmentStatus: 'preparing',
        scheduledFor: '2026-11-10T19:30:00',
      }),
    ]);

    expect(text()).toContain('Programado para');
    expect(button('Ya está listo')).toBeDefined();
    expect(button('Va en camino')).toBeUndefined();
    expect(text()).not.toContain('Ver el punto en el mapa');
  });

  it('pauses ordering from the switch', async () => {
    await answer([]);

    const toggle = element().querySelector('input[type="checkbox"]') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));

    const request = backend.expectOne(`${orderingUrl}/accepting`);
    expect(request.request.body).toEqual({ accepting: false });
    request.flush({ accepting: false });
    await fixture.whenStable();

    expect(text()).toContain('Pedidos en pausa');
  });

  it('hides the switch when the branch has no ordering', async () => {
    await answer([], null);
    expect(element().querySelector('input[type="checkbox"]')).toBeNull();
  });
});
