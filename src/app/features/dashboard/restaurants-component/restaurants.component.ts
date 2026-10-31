import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { catchError, EMPTY, finalize } from 'rxjs';
import { IconsService } from '../../../core/services/icons.service';
import { OrgService } from '../../../core/services/org.service';
import { RestaurantsService } from '../../../core/services/restaurants.service';
import { Mode } from '../../../core/services/types/common.types';
import { Restaurant } from '../../../core/services/types/restaurants.types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import { TitleComponent } from '../../../shared/components/title/title';
import { createPaginationState } from '../../../shared/utils/pagination.util';
import { createSearchState } from '../../../shared/utils/search.util';
import { RestaurantForm } from '../../../core/services/forms/forms.interfaces';

@Component({
  selector: 'app-restaurants.component',
  imports: [
    CommonModule,
    TitleComponent,
    ModalComponent,
    PaginationComponent,
    EmptyStateComponent,
    LucideAngularModule,
  ],
  templateUrl: './restaurants.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestaurantsComponent {
  protected readonly restaurantsService = inject(RestaurantsService);
  private readonly orgService = inject(OrgService);
  private readonly toastrService = inject(ToastrService);
  protected readonly iconsService = inject(IconsService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly mode = signal<Mode>(null);
  readonly target = signal<Restaurant | null>(null);
  readonly confirming = signal(false);
  readonly filters = signal<{ isActive?: boolean }>({});

  readonly form = signal<RestaurantForm>({
    name: '',
    isActive: true,
  });

  readonly trackById = (_: string, restaurant: Restaurant) => restaurant.id;

  readonly restaurants = computed(() => this.restaurantsService.restaurants());

  readonly activeFilterValue = computed(() => {
    const isActive = this.filters().isActive;
    if (isActive === undefined) return '';
    return isActive ? 'true' : 'false';
  });

  readonly modalTitle = computed(() => {
    return this.mode() === 'create' ? 'Nuevo restaurante' : 'Editar restaurante';
  });

  readonly isFormValid = computed(() => {
    const f = this.form();
    return f.name.trim() !== '';
  });

  private readonly paginationState = createPaginationState(
    this.restaurantsService.totalRestaurants,
    {
      onChange: () => this.fetch(),
      loading: this.loading,
    }
  );

  readonly pagination = this.paginationState.pagination;
  readonly pageFrom = this.paginationState.pageFrom;
  readonly pageTo = this.paginationState.pageTo;
  readonly stableTotal = this.paginationState.stableTotal;
  readonly canPrev = this.paginationState.canPrev;
  readonly canNext = this.paginationState.canNext;

  private readonly searchState = createSearchState({
    onSearch: () => {
      this.paginationState.resetToFirstPage();
      this.fetch();
    },
  });

  readonly search = this.searchState.searchTerm;

  constructor() {
    this.fetch();
  }

  private fetch(): void {
    this.loading.set(true);
    const { limit, offset } = this.pagination();

    this.restaurantsService
      .list({
        search: this.search() || undefined,
        isActive: this.filters().isActive,
        limit,
        offset,
      })
      .pipe(
        catchError((error) => {
          console.error('Error loading restaurants:', error);
          this.toastrService.error('No se pudieron cargar los restaurantes');
          return EMPTY;
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  reload(): void {
    this.fetch();
  }

  nextPage = () => this.paginationState.nextPage();
  prevPage = () => this.paginationState.prevPage();
  changeLimit = (e: Event) => this.paginationState.changeLimit(e);
  updateSearch = (e: Event) => this.searchState.updateSearch(e);

  updateFilterActive(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value;

    let isActive: boolean | undefined;

    if (value === '') {
      isActive = undefined;
    } else if (value === 'true') {
      isActive = true;
    } else if (value === 'false') {
      isActive = false;
    }

    this.filters.update((f) => ({ ...f, isActive }));
    this.paginationState.resetToFirstPage();
    this.fetch();
  }

  openCreate(): void {
    this.mode.set('create');
    this.form.set({ name: '', isActive: true });
  }

  openEdit(restaurant: Restaurant): void {
    this.mode.set('edit');
    this.form.set({
      id: restaurant.id,
      name: restaurant.name,
      walletPct: Number(restaurant.walletPct),
      isActive: restaurant.isActive,
    });
  }

  closeModal(): void {
    this.mode.set(null);
    this.form.set({ name: '', isActive: true });
  }

  save(): void {
    const formValue = this.form();

    if (!formValue.name.trim()) return;

    this.saving.set(true);

    const restaurantData: Partial<Restaurant> = {
      name: formValue.name.trim(),
      isActive: formValue.isActive,
      ...(this.mode() === 'edit' && { walletPct: formValue.walletPct }),
    };

    const operation =
      this.mode() === 'create'
        ? this.restaurantsService.create(restaurantData)
        : this.restaurantsService.update(formValue.id!, restaurantData);

    operation
      .pipe(
        catchError((error) => {
          console.error('Error saving restaurant:', error);
          this.toastrService.error('No se pudo guardar el restaurante');
          return EMPTY;
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe(() => {
        this.toastrService.success('Restaurante guardado correctamente');
        this.mode.set(null);
        this.fetch();
        this.orgService.loadRestaurants().subscribe();
      });
  }

  confirmDisable(restaurant: Restaurant): void {
    this.target.set(restaurant);
    this.confirming.set(true);
  }

  closeConfirmation(): void {
    this.confirming.set(false);
    this.target.set(null);
  }

  disable(): void {
    const targetRestaurant = this.target();
    if (!targetRestaurant?.id) return;

    this.restaurantsService
      .update(targetRestaurant.id, { isActive: false })
      .pipe(
        catchError((error) => {
          console.error('Error disabling restaurant:', error);
          this.toastrService.error('No se pudo deshabilitar el restaurante');
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.toastrService.success('Restaurante deshabilitado correctamente');
        this.confirming.set(false);
        this.target.set(null);
        this.fetch();
        this.orgService.loadRestaurants().subscribe();
      });
  }

  updateFormName(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.update((form) => ({ ...form, name: input.value }));
  }

  updateFormWalletPct(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.update((form) => ({ ...form, walletPct: Number(input.value) }));
  }

  updateFormActive(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.update((form) => ({ ...form, isActive: input.checked }));
  }
}
