import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, EMPTY, finalize, Observable } from 'rxjs';
import { OrdersService } from '../../../../core/services/orders.service';
import { OrgService } from '../../../../core/services/org.service';
import { CatalogItem, OrderAccount } from '../../../../core/services/types/orders.type';
import { ModalComponent } from '../../../../shared/components/modal/modal';

interface Line {
  quantity: number;
  note: string;
}

const MAX_QUANTITY = 50;

/** Abre una cuenta desde el panel o le agrega una ronda. */
@Component({
  selector: 'app-tab-modal',
  imports: [CurrencyPipe, ModalComponent],
  templateUrl: './tab-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabModalComponent {
  private readonly ordersService = inject(OrdersService);
  private readonly orgService = inject(OrgService);
  private readonly toastrService = inject(ToastrService);

  readonly isOpen = input.required<boolean>();
  /** Con cuenta se agrega una ronda; sin ella se abre una nueva. */
  readonly account = input<OrderAccount | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly catalog = signal<CatalogItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly search = signal('');
  protected readonly table = signal('');
  protected readonly customerName = signal('');
  protected readonly lines = signal<Record<string, Line>>({});

  protected readonly title = computed(() => {
    const account = this.account();
    return account ? `Agregar ronda · Mesa ${account.table}` : 'Abrir cuenta';
  });

  protected readonly visibleItems = computed(() => {
    const term = this.search().trim().toLowerCase();

    return this.catalog().filter(
      (item) =>
        item.isActive &&
        (!term ||
          item.name.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term))
    );
  });

  protected readonly selected = computed(() => {
    const lines = this.lines();
    return this.catalog().filter((item) => lines[item.id]);
  });

  protected readonly total = computed(() =>
    this.selected().reduce(
      (sum, item) => sum + item.price * this.lines()[item.id].quantity,
      0
    )
  );

  protected readonly canSave = computed(
    () =>
      this.selected().length > 0 && !this.saving() && (!!this.account() || !!this.table().trim())
  );

  constructor() {
    effect(() => {
      if (this.isOpen()) this.reset();
    });
  }

  private reset(): void {
    this.search.set('');
    this.table.set('');
    this.customerName.set('');
    this.lines.set({});

    const branchId = this.orgService.selectedBranchId();
    if (!branchId) return;

    this.loading.set(true);

    this.ordersService
      .catalog(branchId)
      .pipe(
        catchError(() => {
          this.toastrService.error('No se pudo cargar el menú de la sucursal.');
          return EMPTY;
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe((catalog) => this.catalog.set(catalog));
  }

  protected value(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }

  protected quantityOf(item: CatalogItem): number {
    return this.lines()[item.id]?.quantity ?? 0;
  }

  protected noteOf(item: CatalogItem): string {
    return this.lines()[item.id]?.note ?? '';
  }

  protected changeQuantity(item: CatalogItem, delta: number): void {
    this.lines.update((lines) => {
      const current = lines[item.id];
      const quantity = Math.min((current?.quantity ?? 0) + delta, MAX_QUANTITY);

      if (quantity <= 0) {
        const { [item.id]: _removed, ...rest } = lines;
        return rest;
      }

      return { ...lines, [item.id]: { quantity, note: current?.note ?? '' } };
    });
  }

  protected updateNote(item: CatalogItem, ev: Event): void {
    const note = this.value(ev);
    this.lines.update((lines) => ({ ...lines, [item.id]: { ...lines[item.id], note } }));
  }

  protected save(): void {
    if (!this.canSave()) return;

    const branchId = this.orgService.selectedBranchId();
    if (!branchId) return;

    const account = this.account();
    const items = Object.entries(this.lines()).map(([menuItemId, line]) => ({
      menuItemId,
      quantity: line.quantity,
      ...(line.note.trim() && { note: line.note.trim() }),
    }));

    const request: Observable<void> = account
      ? this.ordersService.addRound(account.id, items)
      : this.ordersService.openTab({
          branchId,
          table: this.table().trim(),
          ...(this.customerName().trim() && { customerName: this.customerName().trim() }),
          items,
        });

    this.saving.set(true);

    request
      .pipe(
        catchError(() => {
          this.toastrService.error('No se pudo guardar la comanda.');
          return EMPTY;
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe(() => {
        this.toastrService.success(account ? 'Ronda agregada' : 'Cuenta abierta');
        this.saved.emit();
      });
  }
}
