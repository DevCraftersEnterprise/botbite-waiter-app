import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, filter, Subscription } from 'rxjs';
import { OrdersService } from '../../../core/services/orders.service';
import { OrgService } from '../../../core/services/org.service';
import { SocketService } from '../../../core/services/socket.service';
import { BillingDay } from '../../../core/services/types/orders.type';
import { TitleComponent } from '../../../shared/components/title/title';
import {
  accountLabel,
  cfdiUseLabel,
  PAYMENT_STATUS,
  paymentFormLabel,
  REFUND_STATUS,
} from './billing-labels';

const RELOAD_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-billing',
  imports: [CommonModule, TitleComponent],
  templateUrl: './billing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BillingComponent implements OnDestroy {
  protected readonly orgService = inject(OrgService);
  private readonly ordersService = inject(OrdersService);
  private readonly toastrService = inject(ToastrService);
  private readonly socketService = inject(SocketService);

  protected readonly paymentStatus = PAYMENT_STATUS;
  protected readonly refundStatus = REFUND_STATUS;
  protected readonly accountLabel = accountLabel;
  protected readonly paymentFormLabel = paymentFormLabel;
  protected readonly cfdiUseLabel = cfdiUseLabel;

  protected readonly day = signal<BillingDay | null>(null);
  protected readonly loading = signal(true);
  /** Vacío: hoy, en la zona horaria de la sucursal. */
  protected readonly selectedDate = signal('');
  /** El día de hoy según la sucursal: lo dice la API. */
  protected readonly today = signal('');

  /** Lo cobrado: los pedidos cancelados después de pagar se reembolsan. */
  protected readonly approved = computed(
    () =>
      this.day()?.payments.filter(
        (payment) => payment.status === 'approved' && !payment.toRefund,
      ) ?? [],
  );
  protected readonly collected = computed(() =>
    this.approved().reduce((sum, payment) => sum + payment.paidAmount, 0),
  );
  protected readonly toReview = computed(
    () => (this.day()?.payments.length ?? 0) - this.approved().length,
  );
  protected readonly invoiced = computed(
    () => this.day()?.invoices.reduce((sum, invoice) => sum + invoice.total, 0) ?? 0,
  );

  private branchId: string | null = null;
  /** Descarta respuestas viejas si se cambia de día o de sucursal a media carga. */
  private request = 0;
  private readonly socketSubscription: Subscription;

  constructor() {
    // Solo el día de hoy cambia en vivo.
    this.socketSubscription = this.socketService
      .getOrderUpdates()
      .pipe(
        debounceTime(RELOAD_DEBOUNCE_MS),
        filter(() => !this.selectedDate()),
      )
      .subscribe(() => this.load());

    effect(() => {
      const branchId = this.orgService.selectedBranchId();
      this.branchId = branchId;

      if (!branchId) {
        this.day.set(null);
        this.loading.set(this.orgService.loadingBranches());
        return;
      }

      this.loading.set(true);
      this.socketService.joinBranch(branchId);
      untracked(() => this.load());
    });
  }

  ngOnDestroy(): void {
    this.socketSubscription.unsubscribe();
  }

  protected changeDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.selectedDate.set(!value || value === this.today() ? '' : value);
    this.loading.set(true);
    this.load();
  }

  private load(): void {
    if (!this.branchId) return;

    const request = ++this.request;
    const date = this.selectedDate() || undefined;

    this.ordersService.billing(this.branchId, date).subscribe({
      next: (day) => {
        if (request !== this.request) return;
        if (!date) this.today.set(day.date);
        this.day.set(day);
        this.loading.set(false);
      },
      error: () => {
        if (request !== this.request) return;
        this.loading.set(false);
        this.toastrService.error('Error al cargar los cobros.');
      },
    });
  }
}
