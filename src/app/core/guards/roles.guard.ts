import { inject } from '@angular/core';
import { Router, UrlTree, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../services/types/common.types';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  super: 4,
  admin: 3,
  client: 2,
  user: 1,
};

function hasRequiredRole(
  userRoles: UserRole[] | null | undefined,
  requiredRole: UserRole
): boolean {
  if (!userRoles?.length) return false;

  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  return userRoles.some((role) => {
    const normalizedRole = role.toLowerCase() as UserRole;
    const userLevel = ROLE_HIERARCHY[normalizedRole];
    return userLevel >= requiredLevel;
  });
}

export function createRolesGuard(requiredRole: UserRole): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // Con sesión pero sin el rol, regresa al inicio del panel, no al login.
    const user = auth.user();
    if (user) {
      return hasRequiredRole(user.roles, requiredRole)
        ? true
        : router.navigateByUrl('/dashboard/home');
    }

    if (auth.isAuthenticated()) {
      return new Promise<boolean | UrlTree>((resolve) => {
        auth.loadProfile().subscribe({
          next: (profile) =>
            resolve(
              hasRequiredRole(profile.roles, requiredRole)
                ? true
                : router.navigateByUrl('/dashboard/home')
            ),
          error: () => resolve(router.navigateByUrl('/login')),
        });
      });
    }

    return router.navigateByUrl('/login');
  };
}

export const superGuard = createRolesGuard('super');
export const adminGuard = createRolesGuard('admin');
export const userGuard = createRolesGuard('user');
export const clientGuard = createRolesGuard('client');

export function hasRole(userRoles: UserRole[], role: UserRole): boolean {
  return hasRequiredRole(userRoles, role);
}
