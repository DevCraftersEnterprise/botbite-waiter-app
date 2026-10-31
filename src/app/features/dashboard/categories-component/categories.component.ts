import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { catchError, EMPTY, finalize } from 'rxjs';
import { CategoriesService } from '../../../core/services/categories.service';
import { CategoryForm } from '../../../core/services/forms/forms.interfaces';
import { IconsService } from '../../../core/services/icons.service';
import { OrgService } from '../../../core/services/org.service';
import { Category } from '../../../core/services/types/category.types';
import { Mode } from '../../../core/services/types/common.types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import { TitleComponent } from '../../../shared/components/title/title';
import { createPaginationState } from '../../../shared/utils/pagination.util';
import { createSearchState } from '../../../shared/utils/search.util';

@Component({
  selector: 'app-categories',
  imports: [
    CommonModule,
    TitleComponent,
    ModalComponent,
    PaginationComponent,
    EmptyStateComponent,
    LucideAngularModule,
  ],
  templateUrl: './categories.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesComponent {
  protected readonly categoriesService = inject(CategoriesService);
  protected readonly orgService = inject(OrgService);
  private readonly toastrService = inject(ToastrService);
  protected readonly iconsService = inject(IconsService);

  readonly saving = signal(false);
  readonly mode = signal<Mode>(null);
  readonly confirming = signal(false);
  readonly target = signal<Category | null>(null);
  readonly filters = signal<{ isActive?: boolean }>({});

  readonly form = signal<CategoryForm>({
    name: '',
    sortOrder: 0,
    isActive: true,
  });

  readonly loading = signal(false);
  readonly categories = computed(() => this.categoriesService.categories());
  readonly restaurantId = computed(() => this.orgService.selectedRestaurantId());

  readonly activeFilterValue = computed(() => {
    const isActive = this.filters().isActive;
    if (isActive === undefined) return '';
    return isActive ? 'true' : 'false';
  });

  readonly modalTitle = computed(() => {
    return this.mode() === 'create' ? 'Nueva categoría' : 'Editar categoría';
  });

  readonly isFormValid = computed(() => {
    const f = this.form();
    return f.name.trim() !== '';
  });

  private readonly paginationState = createPaginationState(this.categoriesService.totalCategories, {
    onChange: () => this.fetch(),
    loading: this.loading,
  });

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

  private previousRestaurantId: string | null = null;

  constructor() {
    effect(() => {
      const rid = this.restaurantId();

      if (rid && rid !== this.previousRestaurantId) {
        this.previousRestaurantId = rid;
        this.paginationState.resetToFirstPage();
        this.fetch();
      }
    });
  }

  private fetch(): void {
    const restaurantId = this.restaurantId();
    if (!restaurantId) return;

    this.loading.set(true);
    const { limit, offset } = this.pagination();

    this.categoriesService
      .list({
        restaurantId,
        search: this.search() || undefined,
        isActive: this.filters().isActive,
        limit,
        offset,
      })
      .pipe(
        catchError((error) => {
          console.error('Error loading categories:', error);
          this.toastrService.error('No se pudieron cargar las categorías');
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
    this.form.set({ name: '', sortOrder: 0, isActive: true });
  }

  openEdit(category: Category): void {
    this.mode.set('edit');
    this.form.set({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      isActive: Boolean(category.isActive),
    });
  }

  closeModal(): void {
    this.mode.set(null);
    this.form.set({ name: '', sortOrder: 0, isActive: true });
  }

  save(): void {
    const formValue = this.form();
    if (!formValue.name.trim()) {
      this.toastrService.warning('El nombre de la categoría es obligatorio');
      return;
    }

    this.saving.set(true);

    const categoryData: Partial<Category> = {
      name: formValue.name.trim().toUpperCase(),
      sortOrder: formValue.sortOrder,
      isActive: formValue.isActive,
    };

    const operation =
      this.mode() === 'create'
        ? this.categoriesService.create({ ...categoryData, restaurantId: this.restaurantId()! })
        : this.categoriesService.update(formValue.id!, categoryData);

    operation
      .pipe(
        catchError((error) => {
          console.error('Error saving category:', error);
          this.toastrService.error(
            error?.status === 409
              ? 'El restaurante ya tiene una categoría con ese nombre'
              : 'Error al guardar la categoría'
          );
          return EMPTY;
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe(() => {
        this.toastrService.success('Categoría guardada correctamente');
        this.closeModal();
        this.fetch();
      });
  }

  confirmDisable(category: Category): void {
    this.target.set(category);
    this.confirming.set(true);
  }

  closeConfirmation(): void {
    this.confirming.set(false);
    this.target.set(null);
  }

  disable(): void {
    const targetCategory = this.target();
    if (!targetCategory?.id) return;

    this.categoriesService
      .update(targetCategory.id, { isActive: false })
      .pipe(
        catchError((error) => {
          console.error('Error disabling category:', error);
          this.toastrService.error('Error al deshabilitar la categoría');
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.toastrService.success('Categoría deshabilitada correctamente');
        this.confirming.set(false);
        this.target.set(null);
        this.fetch();
      });
  }

  updateFormName(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.update((form) => ({ ...form, name: input.value }));
  }

  updateFormSortOrder(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.update((form) => ({ ...form, sortOrder: Number(input.value) }));
  }

  updateFormActive(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.update((form) => ({ ...form, isActive: input.checked }));
  }

  handleSave(): void {
    this.save();
  }
}
