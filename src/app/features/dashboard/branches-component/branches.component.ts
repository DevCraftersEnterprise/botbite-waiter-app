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
import { AuthService } from '../../../core/services/auth.service';
import { BranchesService } from '../../../core/services/branches.service';
import { BranchForm } from '../../../core/services/forms/forms.interfaces';
import { IconsService } from '../../../core/services/icons.service';
import { OrgService } from '../../../core/services/org.service';
import { Branch, StaffMember } from '../../../core/services/types/branches.types';
import { Mode } from '../../../core/services/types/common.types';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import { TitleComponent } from '../../../shared/components/title/title';
import { downloadTemplate } from '../../../shared/utils/download-template.util';
import { createPaginationState } from '../../../shared/utils/pagination.util';
import { createSearchState } from '../../../shared/utils/search.util';

@Component({
  selector: 'app-branches',
  imports: [
    CommonModule,
    TitleComponent,
    PaginationComponent,
    ModalComponent,
    EmptyStateComponent,
    LucideAngularModule,
  ],
  templateUrl: './branches.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchesComponent {
  private readonly branchesService = inject(BranchesService);
  protected readonly orgService = inject(OrgService);
  private readonly authService = inject(AuthService);
  private readonly toastrService = inject(ToastrService);
  protected readonly iconsService = inject(IconsService);

  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly mode = signal<Mode>(null);
  readonly confirming = signal(false);
  private confirmEnable = signal<boolean | null>(null);
  readonly target = signal<Branch | null>(null);
  readonly addingMessages = signal(false);
  readonly messagesToAdd = signal(0);
  readonly targetForMessages = signal<Branch | null>(null);
  readonly generatingQr = signal<string | null>(null);
  readonly filters = signal<{ isActive?: boolean }>({});

  private readonly filteredBranches = signal<Branch[]>([]);
  private readonly filteredTotal = signal(0);

  readonly form = signal<BranchForm>({
    name: '',
    address: '',
    phoneNumberAssistant: '',
    phoneNumberReception: '',
    surveyUrl: '',
    isActive: true,
  });

  readonly branches = computed(() => this.filteredBranches());
  readonly total = computed(() => this.filteredTotal());
  readonly restaurantId = computed(() => this.orgService.selectedRestaurantId());
  readonly confirmTargetStatus = computed(() => !!this.confirmEnable());

  readonly activeFilterValue = computed(() => {
    const isActive = this.filters().isActive;
    if (isActive === undefined) return '';
    return isActive ? 'true' : 'false';
  });

  readonly canAddMessages = computed(() => {
    const roles = this.authService.user()?.roles || [];
    return roles.includes('super') || roles.includes('admin');
  });

  /** Dueños y admins administran sucursales; el personal (rol "user") solo consulta. */
  readonly canManage = computed(() => {
    const roles = this.authService.user()?.roles || [];
    return roles.includes('super') || roles.includes('admin') || roles.includes('client');
  });

  // Personal de la sucursal (cajeros y meseros)
  readonly staffBranch = signal<Branch | null>(null);
  readonly staff = signal<StaffMember[]>([]);
  readonly staffLoading = signal(false);
  readonly staffEmail = signal('');
  readonly removingStaffId = signal<string | null>(null);
  readonly staffEmailValid = computed(() =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.staffEmail().trim())
  );

  readonly modalTitle = computed(() =>
    this.mode() === 'create' ? 'Nueva sucursal' : 'Editar sucursal'
  );

  readonly isFormValid = computed(() => {
    const f = this.form();
    return f.name.trim() !== '' && f.address.trim() !== '';
  });

  readonly confirmTitle = computed(() =>
    this.confirmTargetStatus() ? 'Activar sucursal' : 'Desactivar sucursal'
  );

  readonly confirmMessage = computed(() => {
    const action = this.confirmTargetStatus() ? 'activar' : 'desactivar';
    return `¿Seguro que quieres ${action} "${this.target()?.name}"?`;
  });

  readonly addMessagesDisabled = computed(() => this.messagesToAdd() <= 0);

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

  private previousRestaurantId: string | null = null;

  constructor() {
    effect(() => {
      const rid = this.restaurantId();

      if (rid && rid !== this.previousRestaurantId) {
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

    this.branchesService
      .listByRestaurant({
        search: this.searchTerm() || undefined,
        isActive: this.filters().isActive,
        limit,
        offset,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.filteredBranches.set(response.branches);
          this.filteredTotal.set(response.total);
        },
        error: (error) => {
          console.error('Error loading filtered branches:', error);
          this.toastrService.error('Error al cargar las sucursales');
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
      address: '',
      phoneNumberAssistant: '',
      phoneNumberReception: '',
      isActive: true,
      surveyUrl: '',
    });
  }

  openEdit(branch: Branch): void {
    this.mode.set('edit');
    this.form.set({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phoneNumberAssistant: branch.phoneNumberAssistant ?? '',
      phoneNumberReception: branch.phoneNumberReception ?? '',
      isActive: branch.isActive,
      surveyUrl: branch.surveyUrl ?? '',
    });
  }

  closeModal(): void {
    this.mode.set(null);
    this.form.set({
      name: '',
      address: '',
      phoneNumberAssistant: '',
      phoneNumberReception: '',
      isActive: true,
      surveyUrl: '',
    });
  }

  save(): void {
    const f = this.form();
    if (!f.name.trim() || !f.address.trim()) {
      this.toastrService.warning('El nombre y la dirección son obligatorios');
      return;
    }

    this.saving.set(true);

    const { id, ...data } = f;

    const dto: Partial<Branch> = {
      name: data.name.trim(),
      address: data.address.trim(),
      phoneNumberAssistant: data.phoneNumberAssistant?.trim() || null,
      phoneNumberReception: data.phoneNumberReception?.trim() || null,
      surveyUrl: data.surveyUrl?.trim() || null,
    };

    const op =
      this.mode() === 'create'
        ? this.branchesService.create(dto)
        : this.branchesService.update(id!, dto);

    op.pipe(
      catchError((e) => {
        console.error('Error saving branch:', e);
        this.toastrService.error('Error al guardar la sucursal');
        return EMPTY;
      }),
      finalize(() => this.saving.set(false))
    ).subscribe(() => {
      this.toastrService.success('Sucursal guardada correctamente');
      this.closeModal();
      this.reload();
    });
  }

  confirmToggle(branch: Branch, enable: boolean): void {
    this.target.set(branch);
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

    const op = enable ? this.branchesService.activate(b.id) : this.branchesService.deactivate(b.id);

    op.pipe(
      catchError((e) => {
        console.error('Error toggling branch status:', e);
        this.toastrService.error('Error al cambiar el estado de la sucursal');
        return EMPTY;
      }),
      finalize(() => this.closeConfirmation())
    ).subscribe(() => {
      this.toastrService.success(`Sucursal ${enable ? 'activada' : 'desactivada'} correctamente`);
      this.reload();
    });
  }

  openAddMessages(branch: Branch): void {
    this.targetForMessages.set(branch);
    this.messagesToAdd.set(0);
    this.addingMessages.set(true);
  }

  closeAddMessagesModal(): void {
    this.addingMessages.set(false);
    this.targetForMessages.set(null);
    this.messagesToAdd.set(0);
  }

  handleAddMessages(): void {
    const branch = this.targetForMessages();
    const amount = this.messagesToAdd();

    if (!branch || amount <= 0) {
      this.toastrService.warning('Ingresa una cantidad válida de mensajes');
      return;
    }

    this.saving.set(true);

    this.branchesService
      .update(branch.id, {
        availableMessages: amount,
      })
      .pipe(
        catchError((e) => {
          console.error('Error adding messages:', e);
          this.toastrService.error('Error al agregar mensajes');
          return EMPTY;
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe(() => {
        this.toastrService.success(`${amount} mensajes agregados correctamente`);
        this.closeAddMessagesModal();
        this.reload();
      });
  }

  onGenerateQr(branch: Branch): void {
    this.generatingQr.set(branch.id);

    this.branchesService
      .generateQr(branch.id)
      .pipe(
        catchError((e) => {
          console.error('Error generating QR code:', e);
          this.toastrService.error('Error al generar el código QR');
          return EMPTY;
        }),
        finalize(() => this.generatingQr.set(null))
      )
      .subscribe((res) => {
        const updatedGlobal = this.orgService
          .branches()
          .map((b) => (b.id === branch.id ? { ...b, qrUrl: res.qrUrl } : b));
        this.orgService.branches.set(updatedGlobal);

        const updatedLocal = this.filteredBranches().map((b) =>
          b.id === branch.id ? { ...b, qrUrl: res.qrUrl } : b
        );
        this.filteredBranches.set(updatedLocal);

        this.toastrService.success('Código QR generado correctamente');
      });
  }

  onCsvSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.branchesService
      .bulkUploadByCsv(file)
      .pipe(
        catchError((e) => {
          console.error('Error uploading CSV:', e);
          this.toastrService.error('Error al subir el archivo CSV');
          return EMPTY;
        })
      )
      .subscribe(() => {
        input.value = '';
        this.toastrService.success('Sucursales cargadas correctamente');
        this.paginationState.resetToFirstPage();
        this.reload();
      });
  }

  onDownloadTemplate(): void {
    downloadTemplate('branches-template.csv');
  }

  updateForm<K extends keyof BranchForm>(key: K, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.form.update((f) => ({ ...f, [key]: el.value }));
  }

  updateFormChecked<K extends keyof BranchForm>(key: K, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    this.form.update((f) => ({ ...f, [key]: el.checked }));
  }

  updateMessagesToAdd(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.messagesToAdd.set(Number(input.value));
  }

  openStaff(branch: Branch): void {
    this.staffBranch.set(branch);
    this.staffEmail.set('');
    this.staff.set([]);
    this.loadStaff(branch.id);
  }

  closeStaff(): void {
    this.staffBranch.set(null);
    this.staff.set([]);
    this.staffEmail.set('');
  }

  updateStaffEmail(ev: Event): void {
    this.staffEmail.set((ev.target as HTMLInputElement).value);
  }

  addStaff(): void {
    const branch = this.staffBranch();
    const email = this.staffEmail().trim().toLowerCase();

    if (!branch || !this.staffEmailValid()) return;

    this.saving.set(true);

    this.branchesService
      .addStaff(branch.id, email)
      .pipe(
        catchError((e) => {
          console.error('Error assigning staff:', e);
          this.toastrService.error(
            e?.status === 404
              ? 'No existe una cuenta de personal (rol usuario) con ese correo'
              : 'No se pudo asignar al personal'
          );
          return EMPTY;
        }),
        finalize(() => this.saving.set(false))
      )
      .subscribe((member) => {
        this.staff.update((list) =>
          list.some((s) => s.id === member.id) ? list : [...list, member]
        );
        this.staffEmail.set('');
        this.toastrService.success(`${member.email} asignado a ${branch.name}`);
      });
  }

  removeStaff(member: StaffMember): void {
    const branch = this.staffBranch();
    if (!branch) return;

    this.removingStaffId.set(member.id);

    this.branchesService
      .removeStaff(branch.id, member.id)
      .pipe(
        catchError((e) => {
          console.error('Error removing staff:', e);
          this.toastrService.error('No se pudo quitar al personal');
          return EMPTY;
        }),
        finalize(() => this.removingStaffId.set(null))
      )
      .subscribe(() => {
        this.staff.update((list) => list.filter((s) => s.id !== member.id));
        this.toastrService.success(`${member.email} ya no tiene acceso a ${branch.name}`);
      });
  }

  private loadStaff(branchId: string): void {
    this.staffLoading.set(true);

    this.branchesService
      .listStaff(branchId)
      .pipe(
        catchError((e) => {
          console.error('Error loading staff:', e);
          this.toastrService.error('No se pudo cargar el personal de la sucursal');
          return EMPTY;
        }),
        finalize(() => this.staffLoading.set(false))
      )
      .subscribe((staff) => this.staff.set(staff));
  }
}
