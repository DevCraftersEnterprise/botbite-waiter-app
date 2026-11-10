import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';
import { OrgService } from '../../../../core/services/org.service';
import { Branch } from '../../../../core/services/types/branches.types';
import { UserRole } from '../../../../core/services/types/common.types';
import { Ordering } from '../../../../core/services/types/ordering.types';
import { OrderingModalComponent } from './ordering-modal.component';

describe('OrderingModalComponent', () => {
  const url = `${environment.apiBaseUrl}/branches/r1/b1/ordering`;
  let fixture: ComponentFixture<OrderingModalComponent>;
  let backend: HttpTestingController;
  let toastr: jasmine.SpyObj<ToastrService>;
  let component: OrderingModalComponent & Record<string, any>;

  const branch = { id: 'b1', name: 'Morelos' } as Branch;

  const ordering: Ordering = {
    enabled: true,
    accepting: true,
    phoneNumberId: '777000111222',
    phoneNumber: '5216441110000',
    types: ['pickup', 'delivery'],
    delivery: { baseFee: 30, includedKm: 4, extraPer100m: 1, maxKm: 8.5 },
    noDeliveryZones: [],
    hours: [{ days: [0, 1, 2, 3, 4, 5, 6], opens: '18:00', closes: '23:00' }],
    scheduling: {
      enabled: false,
      maxDays: 1,
      minLeadMinutes: 45,
      stepMinutes: 30,
      reminderMinutes: 30,
      cancelUntilMinutes: 60,
    },
    commissionPct: 0.5,
    paymentLinkMinutes: 60,
    prepMinutes: 20,
  };

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent ?? '';
  const input = (selector: string) => element().querySelector(selector) as HTMLInputElement;

  const open = async (roles: UserRole[], body: Ordering | null = ordering) => {
    TestBed.inject(AuthService).user.set({ id: 'u1', email: 'u@botbite.test', roles });
    fixture.componentRef.setInput('branch', branch);
    await fixture.whenStable();
    backend.expectOne(url).flush({ ordering: body });
    await fixture.whenStable();
  };

  beforeEach(async () => {
    toastr = jasmine.createSpyObj<ToastrService>('ToastrService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [OrderingModalComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: ToastrService, useValue: toastr },
        { provide: OrgService, useValue: { selectedRestaurantId: () => 'r1' } },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrderingModalComponent);
    component = fixture.componentInstance as OrderingModalComponent & Record<string, any>;
  });

  afterEach(() => backend.verify());

  it('shows the owner the number and commission without letting them edit it', async () => {
    await open(['client']);

    expect(input('#orderingPhoneNumberId')).toBeNull();
    expect(input('#orderingCommission')).toBeNull();
    expect(text()).toContain('5216441110000');
    expect(text()).toContain('0.5 % sobre el total, envío incluido');

    component['save']();
    const request = backend.expectOne(url);
    expect(request.request.method).toBe('PATCH');
    expect('commissionPct' in request.request.body).toBeFalse();
    expect('enabled' in request.request.body).toBeFalse();
    expect(request.request.body.delivery).toEqual(ordering.delivery);
    request.flush({ ordering });
    await fixture.whenStable();
    expect(toastr.success).toHaveBeenCalledWith('Ajustes de pedidos guardados');
  });

  it('lets an admin turn ordering on with its number', async () => {
    await open(['admin'], null);

    expect(text()).toContain('Los pedidos están apagados');
    const enabled = input('#orderingEnabled');
    enabled.checked = true;
    enabled.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(text()).toContain('Para activar los pedidos captura el phone number ID');
    expect(component['canSave']()).toBeFalse();

    for (const [selector, value] of [
      ['#orderingPhoneNumberId', '777000111222'],
      ['#orderingPhone', '+52 1 644 111 0000'],
    ]) {
      const field = input(selector);
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    expect(component['canSave']()).toBeTrue();

    component['save']();
    const request = backend.expectOne(url);
    expect(request.request.body).toEqual(
      jasmine.objectContaining({
        enabled: true,
        phoneNumberId: '777000111222',
        phoneNumber: '5216441110000',
        types: ['pickup', 'delivery'],
      })
    );
    request.flush({ ordering });
  });

  it('adds a no-delivery zone and only saves once it is complete', async () => {
    await open(['client']);

    component['addZone']();
    await fixture.whenStable();
    expect(component['canSave']()).toBeFalse();
    expect(text()).toContain('La zona 1 necesita un nombre.');

    for (const [selector, value] of [
      ['#zoneName0', 'Colonia X'],
      ['#zoneCoordinates0', '27.5200123, -109.94'],
    ]) {
      const field = input(selector);
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();

    expect(component['canSave']()).toBeTrue();
    expect(text()).toContain('Ver en mapa');

    component['save']();
    const request = backend.expectOne(url);
    expect(request.request.body.noDeliveryZones).toEqual([
      {
        name: 'Colonia X',
        latitude: 27.520012,
        longitude: -109.94,
        radiusMeters: 500,
        days: [],
        from: null,
        to: null,
      },
    ]);
    request.flush({ ordering });
  });

  it('hides delivery settings when only pickup is offered', async () => {
    await open(['client'], { ...ordering, types: ['pickup'] });
    expect(input('#orderingBaseFee')).toBeNull();
    expect(text()).not.toContain('Zonas sin entrega');
  });

  it('explains in Spanish why the server rejected the settings', async () => {
    await open(['admin']);

    component['save']();
    backend
      .expectOne(url)
      .flush(
        { message: ['The branch needs latitude and longitude for delivery'] },
        { status: 400, statusText: 'Bad Request' }
      );
    await fixture.whenStable();

    expect(toastr.error).toHaveBeenCalledWith(
      'Para entregar a domicilio, captura primero las coordenadas de la sucursal en el Mesero digital.'
    );
  });
});
