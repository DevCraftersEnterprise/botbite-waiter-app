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
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { BotService } from '../../../core/services/bot.service';
import { IconsService } from '../../../core/services/icons.service';
import { OrdersService } from '../../../core/services/orders.service';
import { OrgService } from '../../../core/services/org.service';
import { SocketService } from '../../../core/services/socket.service';
import { DeliveryOrder, FulfillmentStatus } from '../../../core/services/types/orders.type';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { TitleComponent } from '../../../shared/components/title/title';
import {
  deliveryMapUrl,
  formatScheduled,
  FULFILLMENT_STATUS,
  groupByStatus,
  nextSteps,
  ORDER_TYPE_LABEL,
} from './to-deliver.util';

const RELOAD_DEBOUNCE_MS = 300;

/** Pedidos de recoger y domicilio pagados que faltan por entregar. */
@Component({
  selector: 'app-to-deliver',
  imports: [CommonModule, LucideAngularModule, ModalComponent, TitleComponent],
  templateUrl: './to-deliver.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToDeliverComponent implements OnDestroy {
  protected readonly orgService = inject(OrgService);
  private readonly ordersService = inject(OrdersService);
  private readonly botService = inject(BotService);
  private readonly authService = inject(AuthService);
  private readonly toastrService = inject(ToastrService);
  private readonly socketService = inject(SocketService);
  protected readonly iconsService = inject(IconsService);

  protected readonly statusLabel = FULFILLMENT_STATUS;
  protected readonly typeLabel = ORDER_TYPE_LABEL;

  protected readonly orders = signal<DeliveryOrder[]>([]);
  protected readonly loading = signal(true);
  protected readonly updatingId = signal<string | null>(null);
  protected readonly columns = computed(() => groupByStatus(this.orders()));

  /** Cancelar implica devolver dinero: solo el dueño y los admins. */
  protected readonly canCancel = computed(() => {
    const roles = this.authService.user()?.roles || [];
    return roles.includes('super') || roles.includes('admin') || roles.includes('client');
  });
  /** Pedido que se va a cancelar, a la espera de confirmar. */
  protected readonly cancelTarget = signal<DeliveryOrder | null>(null);
  protected readonly cancelling = signal(false);

  /** null: la sucursal no tiene pedidos activos y no se muestra el interruptor. */
  protected readonly accepting = signal<boolean | null>(null);
  protected readonly togglingAccepting = signal(false);

  private branchId: string | null = null;
  private readonly socketSubscription: Subscription;

  constructor() {
    // Un pago o un cambio de estado llegan como varios avisos: se recarga una vez.
    this.socketSubscription = this.socketService
      .getOrderUpdates()
      .pipe(debounceTime(RELOAD_DEBOUNCE_MS))
      .subscribe(() => this.load());

    effect(() => {
      const branchId = this.orgService.selectedBranchId();

      untracked(() => {
        this.branchId = branchId;
        this.accepting.set(null);

        if (!branchId) {
          this.orders.set([]);
          this.loading.set(this.orgService.loadingBranches());
          return;
        }

        this.loading.set(true);
        this.socketService.joinBranch(branchId);
        this.load();
        this.loadAccepting(branchId);
      });
    });
  }

  ngOnDestroy(): void {
    this.socketSubscription.unsubscribe();
  }

  protected load(): void {
    if (!this.branchId) return;

    this.ordersService.toDeliver(this.branchId).subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toastrService.error('Error al cargar los pedidos por entregar.');
      },
    });
  }

  private loadAccepting(branchId: string): void {
    this.botService.getOrdering(branchId).subscribe({
      next: (ordering) => this.accepting.set(ordering?.enabled ? ordering.accepting : null),
      // Sin el interruptor la pantalla sigue sirviendo.
      error: () => this.accepting.set(null),
    });
  }

  protected steps(order: DeliveryOrder) {
    return nextSteps(order);
  }

  protected mapUrl(order: DeliveryOrder): string | null {
    return deliveryMapUrl(order.delivery);
  }

  protected scheduled(iso: string): string {
    return formatScheduled(iso);
  }

  protected move(order: DeliveryOrder, status: FulfillmentStatus): void {
    this.updatingId.set(order.id);

    this.ordersService.updateFulfillment(order.id, status).subscribe({
      next: () => {
        this.updatingId.set(null);
        this.load();
      },
      error: () => {
        this.updatingId.set(null);
        this.toastrService.error('No se pudo actualizar el pedido.');
        this.load();
      },
    });
  }

  protected confirmCancel(): void {
    const order = this.cancelTarget();
    if (!order) return;

    this.cancelling.set(true);

    this.ordersService.cancelPaid(order.id).subscribe({
      next: ({ refundAmount, providerPaymentId }) => {
        this.cancelling.set(false);
        this.cancelTarget.set(null);
        const amount = refundAmount.toLocaleString('es-MX', {
          style: 'currency',
          currency: 'MXN',
        });
        this.toastrService.success(
          providerPaymentId
            ? `Pedido cancelado. Reembolsa ${amount} en Mercado Pago (operación ${providerPaymentId}).`
            : 'Pedido cancelado. No se encontró su pago: revísalo en Mercado Pago.'
        );
        this.load();
      },
      error: () => {
        this.cancelling.set(false);
        this.toastrService.error('No se pudo cancelar el pedido.');
        this.load();
      },
    });
  }

  protected toggleAccepting(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const accepting = input.checked;
    if (!this.branchId) return;

    this.togglingAccepting.set(true);

    this.botService.setAccepting(this.branchId, accepting).subscribe({
      next: () => {
        this.togglingAccepting.set(false);
        this.accepting.set(accepting);
        this.toastrService.success(
          accepting ? 'Se reciben pedidos de nuevo' : 'Pedidos en pausa: no entran nuevos'
        );
      },
      error: () => {
        this.togglingAccepting.set(false);
        input.checked = !accepting;
        this.toastrService.error('No se pudo cambiar. Intenta de nuevo.');
      },
    });
  }
}
