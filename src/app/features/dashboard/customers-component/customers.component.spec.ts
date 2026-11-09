import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { OrgService } from '../../../core/services/org.service';
import { CustomerListResponse } from '../../../core/services/types/customers.types';
import { CustomersComponent } from './customers.component';

describe('CustomersComponent', () => {
  const url = `${environment.apiBaseUrl}/restaurants/r1/customers`;
  let fixture: ComponentFixture<CustomersComponent>;
  let backend: HttpTestingController;

  const response = (overrides: Partial<CustomerListResponse> = {}): CustomerListResponse => ({
    customers: [
      {
        id: 'c1',
        name: 'Ana',
        phone: '+521••••••••67',
        visits: 3,
        firstVisitAt: '2026-08-01T18:00:00Z',
        lastVisitAt: '2026-11-07T18:00:00Z',
        spent: 300,
        paidOrders: 2,
        avgTicket: 150,
        walletBalance: 10,
        cashbackEarned: 12.5,
        promos: 'accepted',
        promosAt: '2026-08-01T18:05:00Z',
        status: 'recurring',
        favorites: ['TACO', 'AGUA'],
      },
    ],
    total: 1,
    totals: { customers: 1, newThisMonth: 0, recurring: 1, promosAccepted: 1 },
    exportEnabled: false,
    pagination: { limit: 25, offset: 0 },
    ...overrides,
  });

  const element = () => fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    [...element().querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomersComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['error']) },
        {
          provide: OrgService,
          useValue: {
            selectedRestaurantId: signal('r1'),
            selectedRestaurant: signal({ name: 'Tacos A' }),
          },
        },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CustomersComponent);
    await fixture.whenStable();
  });

  afterEach(() => backend.verify());

  const answer = async (body = response()) => {
    const req = backend.expectOne((r) => r.url === url);
    req.flush(body);
    await fixture.whenStable();
    return req;
  };

  it('loads the customers of the restaurant with their totals', async () => {
    const req = await answer();
    expect(req.request.params.get('sort')).toBe('lastVisitAt');
    expect(req.request.params.get('order')).toBe('desc');

    const text = element().textContent ?? '';
    expect(text).toContain('Ana');
    expect(text).toContain('+521••••••••67');
    expect(text).toContain('Recurrente');
    expect(text).toContain('Aceptó');
    expect(text).toContain('TACO, AGUA');
    expect(text).toContain('Aceptaron promociones');
  });

  it('sorts on the server when a column is clicked', async () => {
    await answer();

    button('Gasto total').click();
    const req = await answer();
    expect(req.request.params.get('sort')).toBe('spent');
    expect(req.request.params.get('order')).toBe('desc');
    expect(req.request.params.get('offset')).toBe('0');
  });

  it('shows the full phone only after asking for it', async () => {
    await answer();

    button('Ver').click();
    backend.expectOne(`${url}/c1/phone`).flush({ phone: '+5216441234567' });
    await fixture.whenStable();

    expect(element().textContent).toContain('+5216441234567');
  });

  it('keeps the export off until the API allows it', async () => {
    await answer();
    expect(button('Exportar CSV').disabled).toBeTrue();
    expect(element().textContent).toContain('La exportación a CSV todavía está apagada');
  });
});
