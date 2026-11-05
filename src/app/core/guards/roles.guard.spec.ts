import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  type CanActivateFn,
} from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { UserProfile } from '../services/types/auth.types';
import { adminGuard, clientGuard, hasRole, superGuard, userGuard } from './roles.guard';

describe('roles guard', () => {
  let router: Router;
  let navigate: jasmine.Spy;
  const auth = {
    user: signal<UserProfile | null>(null),
    authenticated: false,
    profile: of<UserProfile>({ id: 'u1', email: 'ana@botbite.test', roles: ['user'] }),
    isAuthenticated() {
      return this.authenticated;
    },
    loadProfile(): Observable<UserProfile> {
      return this.profile;
    },
  };

  const run = (guard: CanActivateFn) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  const profile = (...roles: UserProfile['roles']): UserProfile => ({
    id: 'u1',
    email: 'ana@botbite.test',
    roles,
  });

  beforeEach(() => {
    auth.user.set(null);
    auth.authenticated = false;
    auth.profile = of(profile('user'));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: auth },
      ],
    });
    router = TestBed.inject(Router);
    navigate = spyOn(router, 'navigateByUrl').and.resolveTo(true);
  });

  describe('hasRole', () => {
    it('follows the hierarchy super > admin > client > user', () => {
      expect(hasRole(['super'], 'admin')).toBeTrue();
      expect(hasRole(['admin'], 'client')).toBeTrue();
      expect(hasRole(['client'], 'user')).toBeTrue();
      expect(hasRole(['user'], 'client')).toBeFalse();
      expect(hasRole(['client'], 'admin')).toBeFalse();
      expect(hasRole(['admin'], 'super')).toBeFalse();
    });

    it('uses the highest of several roles and ignores case', () => {
      expect(hasRole(['user', 'admin'], 'admin')).toBeTrue();
      expect(hasRole(['ADMIN' as never], 'admin')).toBeTrue();
    });

    it('denies an empty role list', () => {
      expect(hasRole([], 'user')).toBeFalse();
    });
  });

  it('lets in a loaded user with the role', () => {
    auth.authenticated = true;
    auth.user.set(profile('admin'));

    expect(run(adminGuard)).toBeTrue();
    expect(run(clientGuard)).toBeTrue();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sends a loaded user without the role to the panel home, not to login', async () => {
    auth.authenticated = true;
    auth.user.set(profile('user'));

    await run(adminGuard);

    expect(navigate).toHaveBeenCalledOnceWith('/dashboard/home');
  });

  it('sends a visitor without a session to login', async () => {
    await run(superGuard);

    expect(navigate).toHaveBeenCalledOnceWith('/login');
  });

  it('loads the profile when there is a session but no user yet', async () => {
    auth.authenticated = true;
    auth.profile = of(profile('client'));

    expect(await run(clientGuard)).toBeTrue();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sends to the panel home when the loaded profile lacks the role', async () => {
    auth.authenticated = true;

    await run(adminGuard);

    expect(navigate).toHaveBeenCalledOnceWith('/dashboard/home');
  });

  it('sends to login when the profile cannot be loaded', async () => {
    auth.authenticated = true;
    auth.profile = throwError(() => new Error('401'));

    await run(userGuard);

    expect(navigate).toHaveBeenCalledOnceWith('/login');
  });
});
