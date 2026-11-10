import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { OrgService } from '../../../core/services/org.service';
import { SocketService } from '../../../core/services/socket.service';
import { BillingDay, BillingPayment } from '../../../core/services/types/orders.type';
import { accountLabel } from './billing-labels';
import { BillingComponent } from './billing.component';

describe('accountLabel', () => {
  it('shows the table, or the kind of order when there is none', () => {
    expect(accountLabel({ table: '4', orderType: 'dine_in' })).toBe('4');
    expect(accountLabel({ table: null, orderType: 'delivery' })).toBe('A domicilio');
    expect(accountLabel({ table: null, orderType: 'pickup' })).toBe('Para recoger');
    expect(accountLabel({ table: null, orderType: null })).toBe('—');
  });
});

describe('BillingComponent', () => {
  const url = `${environment.apiBaseUrl}/orders/billing`;
  let fixture: ComponentFixture<BillingComponent>;
  let backend: HttpTestingController;

  const payment = (overrides: Partial<BillingPayment>): BillingPayment => ({
    id: overrides.providerPaymentId ?? 'p',
    paidAt: '2026-11-09T21:04:00Z',
    status: 'approved',
    orderCode: 'PED-1',
    table: null,
    orderType: 'delivery',
    toRefund: false,
    consumption: 100,
    tip: 0,
    amount: 100,
    paidAmount: 100,
    paymentType: 'credit_card',
    cashbackEarned: 10,
    providerPaymentId: 'MP-1',
    ...overrides,
  });

  const day: BillingDay = {
    date: '2026-11-09',
    payments: [
      payment({ providerPaymentId: 'MP-D1', paidAmount: 147, amount: 147 }),
      payment({
        providerPaymentId: 'MP-P1',
        orderType: 'pickup',
        toRefund: true,
        paidAmount: 105,
        amount: 105,
        cashbackEarned: 10.5,
      }),
      payment({
        providerPaymentId: 'MP-M1',
        orderType: 'dine_in',
        table: '4',
        paidAmount: 56,
        amount: 56,
      }),
    ],
    invoices: [],
  };

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const rowOf = (operation: string) =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')].find((row) =>
      row.textContent?.includes(operation)
    )!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillingComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['error']) },
        {
          provide: OrgService,
          useValue: { selectedBranchId: signal('b1'), loadingBranches: signal(false) },
        },
        {
          provide: SocketService,
          useValue: {
            getOrderUpdates: () => new Subject<{ branchId: string }>().asObservable(),
            joinBranch: jasmine.createSpy('joinBranch'),
          },
        },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BillingComponent);
    await fixture.whenStable();
    backend.expectOne((r) => r.url === url).flush(day);
    await fixture.whenStable();
  });

  afterEach(() => backend.verify());

  it('does not count a cancelled order as collected and asks to refund it', () => {
    expect(text()).toContain('$203.00');
    expect(text()).toContain('2 pago(s) aprobado(s)');
    expect(rowOf('MP-P1').textContent).toContain('Por reembolsar');
    expect(rowOf('MP-P1').querySelector('.line-through')?.textContent).toContain('$10.50');
    expect(rowOf('MP-D1').textContent).toContain('Aprobado');
  });

  it('counts the refund among the payments to review', () => {
    const cards = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.card')];
    const review = cards.find((card) => card.textContent?.includes('Pagos por revisar'))!;
    expect(review.textContent).toContain('1');
    expect(review.textContent).toContain('por reembolsar');
  });

  it('says what kind of order each payment was', () => {
    expect(rowOf('MP-D1').textContent).toContain('A domicilio');
    expect(rowOf('MP-P1').textContent).toContain('Para recoger');
    expect(rowOf('MP-M1').textContent).toContain('4');
  });
});
