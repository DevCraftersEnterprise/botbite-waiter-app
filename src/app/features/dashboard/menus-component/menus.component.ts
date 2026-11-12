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
import { IconsService } from '../../../core/services/icons.service';
import { MenusService } from '../../../core/services/menus.service';
import { OrgService } from '../../../core/services/org.service';
import { Mode } from '../../../core/services/types/common.types';
import { Menu } from '../../../core/services/types/menus.types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import { TitleComponent } from '../../../shared/components/title/title';
import { createPaginationState } from '../../../shared/utils/pagination.util';
import { createSearchState } from '../../../shared/utils/search.util';
import { createMenuSlug } from '../../../shared/utils/slug-genarator.util';
import { Router } from '@angular/router';
import { MenuForm } from '../../../core/services/forms/forms.interfaces';

@Component({
  selector: 'app-menus.component',
  imports: [
    TitleComponent,
    PaginationComponent,
    ModalComponent,
    EmptyStateComponent,
    LucideAngularModule,
  ],
  templateUrl: './menus.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenusComponent {
  private readonly menusService = inject(MenusService);
  private readonly orgService = inject(OrgService);
  private readonly toastrService = inject(ToastrService);
  protected readonly iconsService = inject(IconsService);
  private readonly router = inject(Router);

  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly downloadingMenu = signal(false);
  readonly mode = signal<Mode>(null);
  readonly confirming = signal(false);
  private confirmEnable = signal<boolean | null>(null);
  readonly target = signal<Menu | null>(null);
  readonly filters = signal<{ isActive?: boolean }>({});

  private readonly filteredMenus = signal<Menu[]>([]);
  private readonly filteredTotal = signal(0);

  readonly form = signal<MenuForm>({
    name: '',
    isActive: true,
  });

  readonly menus = computed(() => this.filteredMenus());
  readonly total = computed(() => this.filteredTotal());
  readonly branchId = computed(() => this.orgService.selectedBranchId());
  readonly confirmTargetStatus = computed(() => !!this.confirmEnable());

  readonly activeFilterValue = computed(() => {
    const isActive = this.filters().isActive;
    if (isActive === undefined) return '';
    return isActive ? 'true' : 'false';
  });

  readonly modalTitle = computed(() => (this.mode() === 'create' ? 'Nuevo menú' : 'Editar menú'));

  readonly isFormValid = computed(() => {
    const f = this.form();
    return f.name.trim() !== '';
  });

  readonly confirmTitle = computed(() =>
    this.confirmTargetStatus() ? 'Activar menú' : 'Desactivar menú'
  );

  readonly confirmMessage = computed(() => {
    const action = this.confirmTargetStatus() ? 'activar' : 'desactivar';
    return `¿Seguro que quieres ${action} "${this.target()?.name}"?`;
  });

  private readonly paginationState = createPaginationState(this.total, {
    onChange: () => this.fetch(),
  });

  readonly pagination = this.paginationState.pagination;
  readonly pageFrom = this.paginationState.pageFrom;
  readonly pageTo = this.paginationState.pageTo;
  readonly canPrev = this.paginationState.canPrev;
  readonly canNext = this.paginationState.canNext;

  private readonly searchState = createSearchState({
    onSearch: () => {
      this.paginationState.resetToFirstPage();
      this.fetch();
    },
  });

  readonly searchTerm = this.searchState.searchTerm;

  private previousBranchId: string | null = null;

  constructor() {
    effect(() => {
      const bid = this.branchId();

      if (bid !== this.previousBranchId) {
        this.previousBranchId = bid;
        this.paginationState.resetToFirstPage();
        this.filters.set({});
        this.searchState.searchTerm.set('');
        this.fetch();
      }
    });
  }

  private fetch(): void {
    const bid = this.branchId();

    if (!bid) {
      this.filteredMenus.set([]);
      this.filteredTotal.set(0);
      return;
    }

    this.loading.set(true);
    const { limit, offset } = this.pagination();

    this.menusService
      .findMenusByBranch({
        search: this.searchTerm() || undefined,
        isActive: this.filters().isActive,
        limit,
        offset,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.filteredMenus.set(response);
          this.filteredTotal.set(response.length);
        },
        error: () => {
          console.error('Error fetching menus');
          this.toastrService.error('Error al cargar los menús');
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
      isActive: true,
    });
  }

  openEdit(menu: Menu): void {
    this.mode.set('edit');
    this.form.set({
      id: menu.id,
      name: menu.name,
      isActive: menu.isActive,
    });
  }

  closeModal(): void {
    this.mode.set(null);
    this.form.set({
      name: '',
      isActive: true,
    });
  }

  save(): void {
    const f = this.form();
    if (!f.name.trim()) {
      this.toastrService.error('El nombre es obligatorio');
      return;
    }

    this.saving.set(true);

    const { id, ...data } = f;

    const dto: Partial<Menu> = {
      name: data.name.trim(),
    };

    const op =
      this.mode() === 'create'
        ? this.menusService.createMenu(dto)
        : this.menusService.updateMenu(id!, dto);

    op.pipe(
      catchError((e) => {
        console.error('Error saving menu', e);
        this.toastrService.error('Error al guardar el menú');
        return EMPTY;
      }),
      finalize(() => this.saving.set(false))
    ).subscribe(() => {
      this.toastrService.success(
        `Menú ${this.mode() === 'create' ? 'creado' : 'actualizado'} correctamente`
      );
      this.closeModal();
      this.reload();
    });
  }

  confirmToggle(menu: Menu, enable: boolean): void {
    this.target.set(menu);
    this.confirmEnable.set(!enable);
    this.confirming.set(true);
  }

  closeConfirmation(): void {
    this.confirming.set(false);
    this.target.set(null);
    this.confirmEnable.set(null);
  }

  toggleActive(): void {
    const menu = this.target();
    const enable = this.confirmEnable();

    if (!menu || enable === null) return;

    // Antes solo se imprimía en la consola y el menú no cambiaba (#44).
    this.menusService
      .updateMenu(menu.id, { isActive: enable })
      .pipe(
        catchError((e) => {
          console.error('Error toggling menu status:', e);
          this.toastrService.error('Error al cambiar el estado del menú');
          return EMPTY;
        }),
        finalize(() => this.closeConfirmation())
      )
      .subscribe(() => {
        this.toastrService.success(`Menú ${enable ? 'activado' : 'desactivado'} correctamente`);
        this.reload();
      });
  }

  onPdfSelected(ev: Event, menuId: string): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.menusService
      .uploadMenuFile(file, menuId)
      .pipe(
        catchError((e) => {
          console.error('Error uploading PDF:', e);
          this.toastrService.error('Error al subir el archivo PDF');
          return EMPTY;
        })
      )
      .subscribe(() => {
        input.value = '';
        this.toastrService.success('Archivo PDF subido correctamente');
        this.paginationState.resetToFirstPage();
        this.reload();
      });
  }

  async downloadPdf(menu: Menu): Promise<void> {
    if (!menu.pdfLink) return;

    this.downloadingMenu.set(true);

    try {
      await this.downloadPdfDirectly(menu.pdfLink, menu);
      this.toastrService.success('Descarga iniciada');
    } catch {
      this.handleDownloadFallback(menu.pdfLink);
    } finally {
      this.downloadingMenu.set(false);
    }
  }

  protected viewProducts(menu: Menu): void {
    const slug = createMenuSlug(menu.name, menu.id);
    this.router.navigate(['/dashboard/menus', slug]);
  }

  updateForm<K extends keyof MenuForm>(key: K, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.form.update((f) => ({ ...f, [key]: el.value }));
  }

  updateFormChecked<K extends keyof MenuForm>(key: K, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.form.update((f) => ({ ...f, [key]: el.checked }));
  }

  private async downloadPdfDirectly(url: string, menu: Menu): Promise<void> {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const fileName = `${menu.name}.pdf`;

    this.triggerDownload(blob, fileName);
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(objectUrl);
  }

  private handleDownloadFallback(url: string): void {
    this.toastrService.info('No se pudo descargar automáticamente. Abriendo en nueva pestaña.');
    window.open(url, '_blank');
  }
}
