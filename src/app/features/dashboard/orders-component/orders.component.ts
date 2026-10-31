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
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription } from 'rxjs';
import { IconsService } from '../../../core/services/icons.service';
import { OrdersService } from '../../../core/services/orders.service';
import { OrgService } from '../../../core/services/org.service';
import { SocketService } from '../../../core/services/socket.service';
import {
  OrderAccount,
  OrderRound,
  RoundItem,
  RoundStatus,
} from '../../../core/services/types/orders.type';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { TitleComponent } from '../../../shared/components/title/title';
import { ORDER_STATUS, ROUND_STATUS } from './order-labels';
import { TabModalComponent } from './tab-modal/tab-modal.component';

type AccountAction = 'settle' | 'cancel';

@Component({
  selector: 'app-orders.component',
  imports: [CommonModule, LucideAngularModule, TitleComponent, ModalComponent, TabModalComponent],
  templateUrl: './orders.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersComponent implements OnDestroy {
  protected readonly orgService = inject(OrgService);
  private readonly ordersService = inject(OrdersService);
  private readonly toastrService = inject(ToastrService);
  private readonly socketService = inject(SocketService);
  protected readonly iconsService = inject(IconsService);

  protected readonly orderStatus = ORDER_STATUS;
  protected readonly roundStatus = ROUND_STATUS;

  protected readonly accounts = signal<OrderAccount[]>([]);
  protected readonly loading = signal(true);
  protected readonly updatingRoundId = signal<string | null>(null);

  /** Modal de cuenta: nueva o una ronda más. */
  protected readonly tabOpen = signal(false);
  protected readonly tabAccount = signal<OrderAccount | null>(null);

  protected readonly pendingAction = signal<{
    account: OrderAccount;
    action: AccountAction;
  } | null>(null);
  protected readonly applyingAction = signal(false);

  protected readonly confirmTitle = computed(() =>
    this.pendingAction()?.action === 'settle' ? 'Cobrar cuenta' : 'Cancelar cuenta'
  );

  private branchId: string | null = null;
  private readonly socketSubscription: Subscription;

  constructor() {
    this.socketSubscription = this.socketService.getOrderUpdates().subscribe(() => this.load());

    // La sucursal puede resolverse después de abrir la pantalla (al recargar) o
    // cambiar mientras está abierta.
    effect(() => {
      const branchId = this.orgService.selectedBranchId();
      this.branchId = branchId;

      if (!branchId) {
        this.accounts.set([]);
        this.loading.set(this.orgService.loadingBranches());
        return;
      }

      this.loading.set(true);
      this.socketService.joinBranch(branchId);
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.socketSubscription.unsubscribe();
  }

  protected load(): void {
    if (!this.branchId) return;

    this.ordersService.activeOrders(this.branchId).subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toastrService.error('Error al cargar las órdenes activas.');
      },
    });
  }

  protected lineTotal(item: RoundItem): number {
    return item.price * item.quantity;
  }

  protected canAdvance(round: OrderRound): boolean {
    return round.status === 'new' || round.status === 'preparing';
  }

  protected canAddRound(account: OrderAccount): boolean {
    return account.source === 'staff' && account.status === 'open';
  }

  protected setRoundStatus(round: OrderRound, status: RoundStatus): void {
    this.updatingRoundId.set(round.id);

    this.ordersService.updateRoundStatus(round.id, status).subscribe({
      next: () => {
        this.updatingRoundId.set(null);
        this.load();
      },
      error: () => {
        this.updatingRoundId.set(null);
        this.toastrService.error('No se pudo actualizar la comanda.');
        this.load();
      },
    });
  }

  protected openNewTab(): void {
    this.tabAccount.set(null);
    this.tabOpen.set(true);
  }

  protected openAddRound(account: OrderAccount): void {
    this.tabAccount.set(account);
    this.tabOpen.set(true);
  }

  protected closeTab(): void {
    this.tabOpen.set(false);
    this.tabAccount.set(null);
  }

  protected tabSaved(): void {
    this.closeTab();
    this.load();
  }

  protected askAction(account: OrderAccount, action: AccountAction): void {
    this.pendingAction.set({ account, action });
  }

  protected closeAction(): void {
    this.pendingAction.set(null);
  }

  protected applyAction(): void {
    const pending = this.pendingAction();
    if (!pending) return;

    const { account, action } = pending;
    const request: Observable<void> =
      action === 'settle'
        ? this.ordersService.settle(account.id)
        : this.ordersService.cancel(account.id);

    this.applyingAction.set(true);

    request.subscribe({
      next: () => {
        this.applyingAction.set(false);
        this.closeAction();
        this.toastrService.success(
          action === 'settle' ? 'Cuenta cobrada' : 'Cuenta cancelada'
        );
        this.load();
      },
      error: () => {
        this.applyingAction.set(false);
        this.closeAction();
        this.toastrService.error('No se pudo actualizar la cuenta.');
        this.load();
      },
    });
  }
}
