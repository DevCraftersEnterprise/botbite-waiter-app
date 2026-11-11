import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';
import { catchError, concatMap, EMPTY } from 'rxjs';
import { hasRole } from '../../../core/guards/roles.guard';
import { AlertSoundService } from '../../../core/services/alert-sound.service';
import { AlertsService } from '../../../core/services/alerts.service';
import { AuthService } from '../../../core/services/auth.service';
import { IconsService } from '../../../core/services/icons.service';
import { OrgService } from '../../../core/services/org.service';
import { SocketService } from '../../../core/services/socket.service';
import type { UserRole } from '../../../core/services/types/common.types';
import { RoleBadgeComponent } from '../../../shared/components/role-badge/role-badge';

type NavItem = {
  label: string;
  icon?: LucideIconData;
  to: string;
  requiredRole?: UserRole;
};

@Component({
  selector: 'app-shell-component',
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    RoleBadgeComponent,
    LucideAngularModule,
  ],
  templateUrl: './shell.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  protected authService = inject(AuthService);
  protected orgService = inject(OrgService);
  protected readonly iconsService = inject(IconsService);
  /** La conexión en vivo es de todo el panel: el aviso sale en cualquier pantalla. */
  protected readonly socketService = inject(SocketService);
  /** Numeritos, título y sonidos de la sucursal elegida, en cualquier pantalla. */
  protected readonly alerts = inject(AlertsService);
  protected readonly sound = inject(AlertSoundService);

  open = signal(false);

  private allItems: NavItem[] = [
    { label: 'Inicio', to: '/dashboard/home', icon: this.iconsService.house },
    {
      label: 'Usuarios',
      to: '/dashboard/users',
      requiredRole: 'admin',
      icon: this.iconsService.users,
    },
    {
      label: 'Categorías',
      to: '/dashboard/categories',
      requiredRole: 'client',
      icon: this.iconsService.categories,
    },
    {
      label: 'Restaurantes',
      to: '/dashboard/restaurants',
      requiredRole: 'user',
      icon: this.iconsService.restaurants,
    },
    {
      label: 'Sucursales',
      to: '/dashboard/branches',
      requiredRole: 'user',
      icon: this.iconsService.branches,
    },
    {
      label: 'Productos',
      to: '/dashboard/products',
      requiredRole: 'client',
      icon: this.iconsService.products,
    },
    {
      label: 'Menús',
      to: '/dashboard/menus',
      requiredRole: 'client',
      icon: this.iconsService.menus,
    },
    {
      label: 'Órdenes',
      to: '/dashboard/orders',
      requiredRole: 'user',
      icon: this.iconsService.orders,
    },
    {
      label: 'Cobros',
      to: '/dashboard/billing',
      requiredRole: 'user',
      icon: this.iconsService.bill,
    },
    {
      label: 'Clientes',
      to: '/dashboard/customers',
      requiredRole: 'client',
      icon: this.iconsService.customers,
    },
    {
      label: 'Notificaciones',
      to: '/dashboard/notifications',
      requiredRole: 'user',
      icon: this.iconsService.bell,
    },
    {
      label: 'Para entregar',
      to: '/dashboard/to-deliver',
      requiredRole: 'user',
      icon: this.iconsService.ordering,
    },
  ];

  items = computed(() => {
    const user = this.authService.user();
    if (!user?.roles) return [this.allItems[0]];

    return this.allItems.filter((item) => {
      if (!item.requiredRole) return true;
      return hasRole(user.roles, item.requiredRole);
    });
  });

  restaurants = this.orgService.restaurants;
  selectedRestaurantId = this.orgService.selectedRestaurantId;
  selectedRestaurant = this.orgService.selectedRestaurant;

  branches = this.orgService.branches;
  selectedBranchId = this.orgService.selectedBranchId;
  selectedBranch = this.orgService.selectedBranch;

  ngOnInit(): void {
    this.initializeUserData();
    if (this.authService.isAuthenticated()) this.alerts.start();
  }

  ngOnDestroy(): void {
    this.alerts.stop();
  }

  /** El numerito de cada opción del menú (decisión 5). */
  protected badgeFor(to: string): number {
    if (to === '/dashboard/notifications') return this.alerts.unread();
    if (to === '/dashboard/to-deliver') return this.alerts.paid();
    return 0;
  }

  private initializeUserData(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    if (!this.authService.user()) {
      this.authService
        .loadProfile()
        .pipe(
          catchError(() => {
            this.authService.logout();
            return EMPTY;
          }),
          concatMap(() => this.loadOrganizationData()),
          catchError(() => EMPTY),
        )
        .subscribe();
    } else {
      this.loadOrganizationData().subscribe();
    }
  }

  private loadOrganizationData() {
    return this.orgService.loadRestaurants().pipe(catchError(() => EMPTY));
  }

  displayUser(): string {
    const user = this.authService.user();
    if (!user?.email) return '';

    const role = this.getBestRole(user.roles);
    return role ? `${user.email} - ${role}` : user.email;
  }

  toggle(): void {
    this.open.update((isOpen) => !isOpen);
  }

  closeOnNavigate(): void {
    if (window.innerWidth < 1024) {
      this.open.set(false);
    }
  }

  logout(): void {
    this.alerts.stop();
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  getBestRole(roles?: string[]): string | undefined {
    if (!roles?.length) return undefined;

    const roleSet = new Set(roles.map((role) => role.toLowerCase()));
    const roleHierarchy = ['super', 'admin', 'user'];

    for (const role of roleHierarchy) {
      if (roleSet.has(role)) {
        return role.toUpperCase();
      }
    }

    return roles[0].toUpperCase();
  }

  onSelectRestaurant(id: string): void {
    this.orgService.selectRestaurant(id);
  }

  onSelectBranch(id: string): void {
    this.orgService.selectBranch(id);
  }
}
