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
import { catchError, EMPTY, finalize, tap } from 'rxjs';
import { ProductForm } from '../../../core/services/forms/forms.interfaces';
import { IconsService } from '../../../core/services/icons.service';
import { OrgService } from '../../../core/services/org.service';
import { ProductsService } from '../../../core/services/products.service';
import { Mode } from '../../../core/services/types/common.types';
import { Product } from '../../../core/services/types/products.types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import { TitleComponent } from '../../../shared/components/title/title';
import { createPaginationState } from '../../../shared/utils/pagination.util';
import { createSearchState } from '../../../shared/utils/search.util';
import { logError } from '../../../core/services/error-log';

@Component({
  selector: 'app-products.component',
  imports: [
    CommonModule,
    TitleComponent,
    PaginationComponent,
    ModalComponent,
    EmptyStateComponent,
    LucideAngularModule,
  ],
  templateUrl: './products.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsComponent {
  protected readonly productsService = inject(ProductsService);
  private readonly orgService = inject(OrgService);
  private readonly toastrService = inject(ToastrService);
  protected readonly iconsService = inject(IconsService);

  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly mode = signal<Mode>(null);
  readonly confirming = signal(false);
  private confirmEnable = signal<boolean | null>(null);
  readonly target = signal<Product | null>(null);
  readonly filters = signal<{ isActive?: boolean }>({});
  readonly imagePreview = signal<Product | null>(null);

  readonly form = signal<ProductForm>({
    name: '',
    description: '',
    isActive: true,
  });

  readonly restaurantId = computed(() => this.orgService.selectedRestaurantId());
  readonly confirmTargetStatus = computed(() => !!this.confirmEnable());

  readonly activeFilterValue = computed(() => {
    const isActive = this.filters().isActive;
    if (isActive === undefined) return '';
    return isActive ? 'true' : 'false';
  });

  readonly modalTitle = computed(() =>
    this.mode() === 'create' ? 'Crear Producto' : 'Editar Producto'
  );

  readonly isFormValid = computed(() => {
    const f = this.form();
    return f.name.trim() !== '';
  });

  readonly confirmTitle = computed(() =>
    this.confirmTargetStatus() ? 'Activar producto' : 'Desactivar producto'
  );

  readonly confirmMessage = computed(() => {
    const action = this.confirmTargetStatus() ? 'activar' : 'desactivar';
    return `¿Seguro que quieres ${action} "${this.target()?.name}"?`;
  });

  private readonly paginationState = createPaginationState(this.productsService.totalProducts, {
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

  readonly searchTerm = this.searchState.searchTerm;

  private previousRestaurantId: string | null = null;

  constructor() {
    effect(() => {
      const rid = this.restaurantId();
      if (rid && this.previousRestaurantId !== rid) {
        this.previousRestaurantId = rid;
        this.paginationState.resetToFirstPage();
        this.filters.set({});
        this.searchState.searchTerm.set('');
        this.fetch();
      }
    });
  }

  private fetch(): void {
    const rid = this.restaurantId();
    if (!rid) return;

    this.loading.set(true);

    const { limit, offset } = this.pagination();

    this.productsService
      .findAllProductsByRestaurant(rid, {
        search: this.searchTerm() || undefined,
        isActive: this.filters().isActive,
        limit,
        offset,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        error: (error) => {
          this.toastrService.error('Error al cargar los productos');
          logError('Error loading products:', error);
        },
      });
  }

  reload(): void {
    this.fetch();
  }

  nextPage = () => this.paginationState.nextPage();
  prevPage = () => this.paginationState.prevPage();
  changeLimit = (e: Event) => this.paginationState.changeLimit(e);
  updateFilterSearch = (e: Event) => this.searchState.updateSearch(e);

  updateFilterActive(event: Event): void {
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
    this.form.set({
      name: '',
      description: '',
      isActive: true,
    });
  }

  openEdit(product: Product): void {
    this.mode.set('edit');
    this.form.set({
      id: product.id,
      name: product.name,
      description: product.description ?? '',
      isActive: product.isActive,
    });
  }

  closeModal(): void {
    this.mode.set(null);
    this.form.set({
      name: '',
      description: '',
      isActive: true,
    });
  }

  save(): void {
    const f = this.form();
    if (!f.name.trim()) {
      this.toastrService.warning('El nombre es obligatorio');
      return;
    }

    this.saving.set(true);

    const { id, ...data } = f;

    const dto: Partial<Product> = {
      name: data.name.trim(),
      description: data.description?.trim(),
    };

    const op =
      this.mode() === 'create'
        ? this.productsService.createProduct(this.restaurantId()!, dto)
        : this.productsService.updateProduct(this.restaurantId()!, id!, dto);

    op.pipe(
      catchError((e) => {
        logError('Error saving product:', e);
        this.toastrService.error('Error al guardar el producto');
        return EMPTY;
      }),
      finalize(() => this.saving.set(false))
    ).subscribe(() => {
      this.toastrService.success('Producto guardado correctamente');
      this.closeModal();
      this.reload();
    });
  }

  confirmToggle(product: Product, enable: boolean): void {
    this.target.set(product);
    this.confirmEnable.set(enable);
    this.confirming.set(true);
  }

  closeConfirmation(): void {
    this.confirming.set(false);
    this.target.set(null);
    this.confirmEnable.set(null);
  }

  toggleActive(): void {
    const b = this.target();
    const enable = this.confirmEnable();
    if (!b || enable === null) return;

    const op = enable
      ? this.productsService.activateProduct(this.restaurantId()!, b.id)
      : this.productsService.deactivateProduct(this.restaurantId()!, b.id);

    op.pipe(
      tap((updatedProduct) => {
        this.productsService.products.update((products) =>
          products.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
        );
      }),
      catchError((e) => {
        logError('Error toggling product status:', e);
        this.toastrService.error('Error al cambiar el estado del producto');
        return EMPTY;
      }),
      finalize(() => this.closeConfirmation())
    ).subscribe(() => {
      this.toastrService.success(`Producto ${enable ? 'activado' : 'desactivado'} correctamente`);
      this.reload();
    });
  }

  updateForm<K extends keyof ProductForm>(key: K, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.form.update((f) => ({ ...f, [key]: el.value }));
  }

  updateFormChecked<K extends keyof ProductForm>(key: K, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.form.update((f) => ({ ...f, [key]: el.checked }));
  }

  onImageSelected(product: Product, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validar que sea una imagen
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      this.toastrService.error('Solo se permiten archivos JPEG, PNG, WebP y GIF');
      input.value = '';
      return;
    }

    // Validar tamaño máximo (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.toastrService.error('El archivo excede el tamaño máximo de 5MB');
      input.value = '';
      return;
    }

    this.productsService
      .uploadProductImage(this.restaurantId()!, product.id, file)
      .pipe(
        catchError((e) => {
          logError('Error uploading image:', e);
          this.toastrService.error('Error al subir la imagen');
          return EMPTY;
        })
      )
      .subscribe(() => {
        input.value = '';
        this.toastrService.success('Imagen subida correctamente');
        this.reload();
      });
  }

  openImagePreview(product: Product): void {
    this.imagePreview.set(product);
  }

  closeImagePreview(): void {
    this.imagePreview.set(null);
  }
}
