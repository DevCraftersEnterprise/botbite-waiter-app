import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { catchError, EMPTY, finalize, Observable } from 'rxjs';
import {
  FieldErrors,
  formErrorSummary,
  toFormErrors,
} from '../../../shared/utils/api-errors.util';
import { IconsService } from '../../../core/services/icons.service';
import { OrgService } from '../../../core/services/org.service';
import { RestaurantsService } from '../../../core/services/restaurants.service';
import { Mode } from '../../../core/services/types/common.types';
import {
  Restaurant,
  RestaurantResponse,
} from '../../../core/services/types/restaurants.types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import { TitleComponent } from '../../../shared/components/title/title';
import { createPaginationState } from '../../../shared/utils/pagination.util';
import { createSearchState } from '../../../shared/utils/search.util';
import { RestaurantForm } from '../../../core/services/forms/forms.interfaces';
import { logError } from '../../../core/services/error-log';

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

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

  /** Lo que rechazó la API, junto a su campo. */
  readonly fieldErrors = signal<FieldErrors>({});

  /** Logo del restaurante que se edita; se sube aparte, al elegirlo. */
  readonly logoUrl = signal<string | null>(null);
  readonly logoSaving = signal(false);

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
          logError('Error loading restaurants:', error);
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
      privacyUrl: restaurant.privacyUrl ?? '',
      isActive: restaurant.isActive,
    });
    this.logoUrl.set(restaurant.logoUrl ?? null);
  }

  closeModal(): void {
    this.mode.set(null);
    this.fieldErrors.set({});
    this.logoUrl.set(null);
    this.form.set({ name: '', isActive: true });
  }

  save(): void {
    const formValue = this.form();

    if (!formValue.name.trim()) return;

    this.saving.set(true);
    this.fieldErrors.set({});

    const restaurantData: Partial<Restaurant> = {
      name: formValue.name.trim(),
      isActive: formValue.isActive,
      ...(this.mode() === 'edit' && {
        walletPct: formValue.walletPct,
        privacyUrl: formValue.privacyUrl?.trim() || null,
      }),
    };

    const operation =
      this.mode() === 'create'
        ? this.restaurantsService.create(restaurantData)
        : this.restaurantsService.update(formValue.id!, restaurantData);

    operation
      .pipe(
        catchError((error) => {
          logError('Error saving restaurant:', error);
          const errors = toFormErrors(error, ['name', 'walletPct', 'privacyUrl']);
          this.fieldErrors.set(errors.fields);
          this.toastrService.error(formErrorSummary(errors));
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
          logError('Error disabling restaurant:', error);
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
    this.clearFieldError('name');
  }

  updateFormWalletPct(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.update((form) => ({ ...form, walletPct: Number(input.value) }));
    this.clearFieldError('walletPct');
  }

  updateFormPrivacyUrl(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.update((form) => ({ ...form, privacyUrl: input.value }));
    this.clearFieldError('privacyUrl');
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const id = this.form().id;
    if (!file || !id) return;

    if (!LOGO_TYPES.includes(file.type)) {
      this.toastrService.error('El logo debe ser PNG, JPG o WebP');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      this.toastrService.error('El logo debe pesar menos de 5 MB');
      return;
    }

    this.changeLogo(this.restaurantsService.uploadLogo(id, file), 'Logo actualizado');
  }

  removeLogo(): void {
    const id = this.form().id;
    if (id) this.changeLogo(this.restaurantsService.removeLogo(id), 'Logo quitado');
  }

  private changeLogo(request: Observable<RestaurantResponse>, success: string): void {
    this.logoSaving.set(true);
    request
      .pipe(
        catchError((error) => {
          logError('Error saving restaurant logo:', error);
          this.toastrService.error(formErrorSummary(toFormErrors(error, [])));
          return EMPTY;
        }),
        finalize(() => this.logoSaving.set(false))
      )
      .subscribe(({ restaurant }) => {
        this.logoUrl.set(restaurant.logoUrl ?? null);
        this.toastrService.success(success);
        this.fetch();
        this.orgService.loadRestaurants().subscribe();
      });
  }

  fieldClass(field: string): string {
    return this.fieldErrors()[field] ? 'border-red-500 bg-red-50/40' : 'border-black/10';
  }

  private clearFieldError(field: string): void {
    if (!this.fieldErrors()[field]) return;
    this.fieldErrors.update((errors) => {
      const next = { ...errors };
      delete next[field];
      return next;
    });
  }

  updateFormActive(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.update((form) => ({ ...form, isActive: input.checked }));
  }
}
