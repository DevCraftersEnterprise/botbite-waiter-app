import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { catchError, EMPTY } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { UserForm } from '../../../core/services/forms/forms.interfaces';
import { IconsService } from '../../../core/services/icons.service';
import { Mode, UserRole } from '../../../core/services/types/common.types';
import { UserRow } from '../../../core/services/types/users.types';
import { UsersService } from '../../../core/services/users.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { ModalComponent } from '../../../shared/components/modal/modal';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import { RoleBadgeComponent } from '../../../shared/components/role-badge/role-badge';
import { TitleComponent } from '../../../shared/components/title/title';
import { createPaginationState } from '../../../shared/utils/pagination.util';
import { createSearchState } from '../../../shared/utils/search.util';

@Component({
  selector: 'app-users.component',
  imports: [
    CommonModule,
    TitleComponent,
    PaginationComponent,
    ModalComponent,
    RoleBadgeComponent,
    EmptyStateComponent,
    LucideAngularModule,
  ],
  templateUrl: './users.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent {
  protected readonly usersService = inject(UsersService);
  private readonly authService = inject(AuthService);
  private readonly toastrService = inject(ToastrService);
  protected readonly iconsService = inject(IconsService);

  readonly loading = signal(false);
  readonly roleFilter = signal<UserRole | ''>('');
  readonly mode = signal<Mode>(null);
  readonly saving = signal(false);
  readonly form = signal<UserForm>({ email: '', password: '' });

  readonly confirmingToggle = signal(false);
  readonly targetUser = signal<UserRow | null>(null);
  readonly targetAction = signal<'activate' | 'deactivate' | null>(null);

  readonly confirmingAdminRole = signal(false);
  readonly targetUserRole = signal<UserRow | null>(null);
  readonly targetRoleAction = signal<'add' | 'remove' | null>(null);

  readonly me = computed(() => this.authService.user());
  readonly myId = computed(() => this.me()?.id);
  readonly isSuper = computed(() =>
    (this.me()?.roles || []).map((r) => r.toLowerCase()).includes('super')
  );
  readonly isAdmin = computed(() =>
    (this.me()?.roles || []).map((r) => r.toLowerCase()).includes('admin')
  );

  readonly modalTitle = computed(() => {
    const currentMode = this.mode();
    if (currentMode === 'create-user') return 'Crear Usuario';
    if (currentMode === 'create-client') return 'Crear Cliente';
    return '';
  });

  readonly isFormValid = computed(() => {
    const f = this.form();
    // La API exige al menos 8 caracteres.
    return f.email.trim() !== '' && f.password.trim().length >= 8;
  });

  readonly toggleConfirmTitle = computed(() =>
    this.targetAction() === 'activate' ? 'Activar usuario' : 'Desactivar usuario'
  );

  readonly toggleConfirmMessage = computed(() => {
    const action = this.targetAction() === 'activate' ? 'activar' : 'desactivar';
    return `¿Seguro que quieres ${action} a "${this.targetUser()?.email}"?`;
  });

  readonly adminRoleConfirmTitle = computed(() =>
    this.targetRoleAction() === 'add' ? 'Agregar rol de Admin' : 'Quitar rol de Admin'
  );

  readonly adminRoleConfirmMessage = computed(() => {
    const action = this.targetRoleAction() === 'add' ? 'agregar' : 'quitar';
    return `¿Seguro que quieres ${action} el rol de administrador a "${
      this.targetUserRole()?.email
    }"?`;
  });

  private readonly paginationState = createPaginationState(this.usersService.totalUsers, {
    onChange: () => this.reload(),
  });

  readonly pagination = this.paginationState.pagination;
  readonly pageFrom = this.paginationState.pageFrom;
  readonly pageTo = this.paginationState.pageTo;
  readonly canPrev = this.paginationState.canPrev;
  readonly canNext = this.paginationState.canNext;

  private readonly searchState = createSearchState({
    onSearch: () => {
      this.paginationState.resetToFirstPage();
      this.reload();
    },
  });

  readonly search = this.searchState.searchTerm;

  constructor() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    const { limit, offset } = this.pagination();

    this.usersService
      .list({
        search: this.search() || undefined,
        role: this.roleFilter() || undefined,
        limit,
        offset,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toastrService.error('Error al cargar los usuarios');
        },
      });
  }

  nextPage = () => this.paginationState.nextPage();
  prevPage = () => this.paginationState.prevPage();
  changeLimit = (e: Event) => this.paginationState.changeLimit(e);
  updateSearch = (e: Event) => this.searchState.updateSearch(e);

  updateRole(e: Event) {
    const v = (e.target as HTMLSelectElement).value as UserRole | '';
    this.roleFilter.set(v);
    this.pagination.update((p) => ({ ...p, offset: 0 }));
    this.reload();
  }

  openCreateUser() {
    this.mode.set('create-user');
    this.form.set({ email: '', password: '' });
  }

  openCreateClient() {
    this.mode.set('create-client');
    this.form.set({ email: '', password: '' });
  }

  closeModal() {
    this.mode.set(null);
    this.form.set({ email: '', password: '' });
  }

  save() {
    const { email, password } = this.form();
    if (!email || !password) {
      this.toastrService.warning('Email y contraseña son obligatorios');
      return;
    }

    this.saving.set(true);

    const role = this.mode() === 'create-client' ? 'client' : 'user';

    this.usersService.registerUserOrClient({ email, password }, `register-${role}`).subscribe({
      next: () => {
        this.toastrService.success('Usuario registrado');
        this.closeModal();
        this.saving.set(false);
        this.reload();
      },
      error: () => {
        this.toastrService.error('No se pudo registrar al usuario');
        this.saving.set(false);
      },
    });
  }

  canActOn(row: UserRow) {
    if (row.id === this.myId()) return false;
    const userRoles = (row.roles || []).map((r) => r.toLowerCase());
    if (userRoles.includes('super')) return false;
    if (this.isSuper()) return true;
    if (this.isAdmin() && !userRoles.includes('admin')) return true;
    return false;
  }

  confirmToggleUser(user: UserRow, action: 'activate' | 'deactivate') {
    if (!this.canActOn(user)) {
      this.toastrService.warning(
        `No puedes ${action === 'activate' ? 'activar' : 'desactivar'} este usuario`
      );
      return;
    }

    this.targetUser.set(user);
    this.targetAction.set(action);
    this.confirmingToggle.set(true);
  }

  closeToggleConfirmation(): void {
    this.confirmingToggle.set(false);
    this.targetUser.set(null);
    this.targetAction.set(null);
  }

  executeToggle(): void {
    const user = this.targetUser();
    const action = this.targetAction();

    if (!user || !action) return;

    if (action === 'activate') this.activate(user);
    else this.deactivate(user);

    this.closeToggleConfirmation();
  }

  activate(row: UserRow) {
    this.usersService
      .activateUser(row.id)
      .pipe(
        catchError((e) => {
          console.error(e);
          this.toastrService.error('Error al activar el usuario');
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.toastrService.success('Usuario activado correctamente');
        this.reload();
      });
  }

  deactivate(row: UserRow) {
    this.usersService
      .deactivateUser(row.id)
      .pipe(
        catchError((e) => {
          console.error(e);
          this.toastrService.error('Error al desactivar el usuario');
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.toastrService.success('Usuario desactivado correctamente');
        this.reload();
      });
  }

  confirmAdminRoleChange(user: UserRow, action: 'add' | 'remove'): void {
    if (!this.canActOn(user)) {
      this.toastrService.warning('No puedes modificar este usuario');
      return;
    }

    if (action === 'remove' && !this.isSuper()) {
      this.toastrService.warning('Solo un superusuario puede quitar roles de administrador');
      return;
    }

    this.targetUserRole.set(user);
    this.targetRoleAction.set(action);
    this.confirmingAdminRole.set(true);
  }

  closeAdminRoleConfirmation(): void {
    this.confirmingAdminRole.set(false);
    this.targetUserRole.set(null);
    this.targetRoleAction.set(null);
  }

  executeAdminRoleChange(): void {
    const user = this.targetUserRole();
    const action = this.targetRoleAction();

    if (!user || !action) return;

    if (action === 'add') {
      this.addAdmin(user);
    } else {
      this.removeAdmin(user);
    }

    this.closeAdminRoleConfirmation();
  }

  hasRole(row: UserRow, role: UserRole) {
    return (row.roles || []).map((r) => r.toLowerCase()).includes(role);
  }

  addAdmin(row: UserRow) {
    this.usersService
      .addAdminRole(row.id)
      .pipe(
        catchError((e) => {
          console.error(e);
          this.toastrService.error('Error al añadir el rol de administrador');
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.toastrService.success('Rol de administrador añadido');
        this.reload();
      });
  }

  removeAdmin(row: UserRow) {
    this.usersService
      .removeAdminRole(row.id)
      .pipe(
        catchError((e) => {
          console.error(e);
          this.toastrService.error('Error al eliminar el rol de administrador');
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.toastrService.success('Rol de administrador eliminado');
        this.reload();
      });
  }

  updateFormEmail(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    this.form.update((f) => ({ ...f, email: value }));
  }

  updateFormPassword(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    this.form.update((f) => ({ ...f, password: value }));
  }
}
