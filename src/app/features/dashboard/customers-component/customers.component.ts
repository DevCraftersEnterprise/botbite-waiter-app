import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs';
import { CustomersService } from '../../../core/services/customers.service';
import { IconsService } from '../../../core/services/icons.service';
import { OrgService } from '../../../core/services/org.service';
import {
  CustomerPromos,
  CustomerQuery,
  CustomerSort,
  CustomerStatus,
  CustomerTotals,
  RestaurantCustomer,
} from '../../../core/services/types/customers.types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import { TitleComponent } from '../../../shared/components/title/title';
import { createPaginationState } from '../../../shared/utils/pagination.util';
import { createSearchState } from '../../../shared/utils/search.util';
import { downloadBlob } from '../menu-items-component/menu-csv-import/menu-csv.util';
import {
  ariaSort,
  nextSort,
  PROMOS_OPTIONS,
  promosLabel,
  SortState,
  STATUS_OPTIONS,
  statusBadge,
  statusLabel,
} from './customers.util';
import { logError } from '../../../core/services/error-log';

/**
 * Clientes del restaurante: visitas, consumo, monedero y promociones. Los
 * teléfonos salen parcialmente ocultos; ver uno completo y exportar quedan
 * registrados en la API.
 */
@Component({
  selector: 'app-customers',
  imports: [
    CurrencyPipe,
    DatePipe,
    LucideAngularModule,
    TitleComponent,
    PaginationComponent,
    EmptyStateComponent,
  ],
  templateUrl: './customers.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersComponent {
  private readonly customersService = inject(CustomersService);
  private readonly orgService = inject(OrgService);
  private readonly toastr = inject(ToastrService);
  protected readonly iconsService = inject(IconsService);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly promosOptions = PROMOS_OPTIONS;
  protected readonly statusLabel = statusLabel;
  protected readonly statusBadge = statusBadge;
  protected readonly promosLabel = promosLabel;

  protected readonly customers = signal<RestaurantCustomer[]>([]);
  protected readonly total = signal(0);
  protected readonly totals = signal<CustomerTotals | null>(null);
  protected readonly exportEnabled = signal(false);
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);

  protected readonly status = signal<CustomerStatus | ''>('');
  protected readonly promos = signal<CustomerPromos | ''>('');
  protected readonly sortState = signal<SortState>({ sort: 'lastVisitAt', order: 'desc' });

  /** Teléfonos completos que ya se pidieron en esta visita, por cliente. */
  protected readonly revealed = signal<Record<string, string>>({});
  protected readonly revealingId = signal<string | null>(null);

  protected readonly restaurantId = computed(() => this.orgService.selectedRestaurantId());
  protected readonly restaurantName = computed(
    () => this.orgService.selectedRestaurant()?.name ?? ''
  );

  private readonly paginationState = createPaginationState(this.total, {
    initialLimit: 25,
    loading: this.loading,
    onChange: () => this.fetch(),
  });

  readonly pagination = this.paginationState.pagination;
  readonly pageFrom = this.paginationState.pageFrom;
  readonly pageTo = this.paginationState.pageTo;
  readonly canPrev = this.paginationState.canPrev;
  readonly canNext = this.paginationState.canNext;

  private readonly searchState = createSearchState({
    onSearch: () => this.refetchFromStart(),
  });

  readonly searchTerm = this.searchState.searchTerm;

  constructor() {
    // El restaurante puede resolverse después de abrir la pantalla o cambiar.
    effect(() => {
      const restaurantId = this.restaurantId();
      // Solo depende del restaurante: filtros, orden y página piden por su cuenta.
      untracked(() => {
        if (restaurantId) {
          this.revealed.set({});
          this.paginationState.resetToFirstPage();
          this.fetch();
        } else {
          this.customers.set([]);
          this.total.set(0);
          this.totals.set(null);
        }
      });
    });
  }

  private query(): CustomerQuery {
    const { sort, order } = this.sortState();
    return {
      limit: this.pagination().limit,
      offset: this.pagination().offset,
      search: this.searchTerm().trim() || undefined,
      status: this.status() || undefined,
      promos: this.promos() || undefined,
      sort,
      order,
    };
  }

  private fetch(): void {
    const restaurantId = this.restaurantId();
    if (!restaurantId) return;

    this.loading.set(true);
    this.customersService
      .list(restaurantId, this.query())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.customers.set(response.customers);
          this.total.set(response.total);
          this.totals.set(response.totals);
          this.exportEnabled.set(response.exportEnabled);
        },
        error: (error) => {
          logError('Error loading customers:', error);
          this.toastr.error('No se pudieron cargar los clientes');
        },
      });
  }

  private refetchFromStart(): void {
    this.paginationState.resetToFirstPage();
    this.fetch();
  }

  nextPage = () => this.paginationState.nextPage();
  prevPage = () => this.paginationState.prevPage();
  changeLimit = (e: Event) => this.paginationState.changeLimit(e);
  updateSearch = (e: Event) => this.searchState.updateSearch(e);

  protected updateStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as CustomerStatus | '');
    this.refetchFromStart();
  }

  protected updatePromos(event: Event): void {
    this.promos.set((event.target as HTMLSelectElement).value as CustomerPromos | '');
    this.refetchFromStart();
  }

  protected sortBy(column: CustomerSort): void {
    this.sortState.update((current) => nextSort(current, column));
    this.refetchFromStart();
  }

  protected ariaSort(column: CustomerSort) {
    return ariaSort(this.sortState(), column);
  }

  protected sortMark(column: CustomerSort): string {
    const { sort, order } = this.sortState();
    return sort !== column ? '' : order === 'asc' ? '↑' : '↓';
  }

  protected phoneOf(customer: RestaurantCustomer): string {
    return this.revealed()[customer.id] ?? customer.phone;
  }

  protected revealPhone(customer: RestaurantCustomer): void {
    const restaurantId = this.restaurantId();
    if (!restaurantId) return;

    this.revealingId.set(customer.id);
    this.customersService
      .revealPhone(restaurantId, customer.id)
      .pipe(finalize(() => this.revealingId.set(null)))
      .subscribe({
        next: ({ phone }) => this.revealed.update((all) => ({ ...all, [customer.id]: phone })),
        error: () => this.toastr.error('No se pudo mostrar el teléfono'),
      });
  }

  protected exportCsv(): void {
    const restaurantId = this.restaurantId();
    if (!restaurantId || !this.exportEnabled()) return;

    this.exporting.set(true);
    this.customersService
      .export(restaurantId, this.query())
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe({
        next: (blob) => downloadBlob(blob, 'clientes.csv'),
        error: () => this.toastr.error('No se pudo exportar la lista de clientes'),
      });
  }
}
