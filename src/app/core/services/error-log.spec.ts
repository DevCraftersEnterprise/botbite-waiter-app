import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { logError } from './error-log';

describe('logError (#43)', () => {
  let auth: AuthService;
  let consoleError: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    consoleError = spyOn(console, 'error');
  });

  it('shows errors to a super user', () => {
    auth.user.set({ id: 'u1', email: 'super@botbite.test', roles: ['super'] });

    logError('Error loading branches:', { status: 500 });

    expect(consoleError).toHaveBeenCalledOnceWith('Error loading branches:', { status: 500 });
  });

  for (const role of ['admin', 'client', 'user'] as const) {
    it(`hides them from a ${role} user`, () => {
      auth.user.set({ id: 'u1', email: `${role}@botbite.test`, roles: [role] });

      logError('Error loading branches:', { status: 500 });

      expect(consoleError).not.toHaveBeenCalled();
    });
  }

  it('hides them before the profile loads and after logout', () => {
    logError('Antes del perfil');
    auth.user.set({ id: 'u1', email: 'super@botbite.test', roles: ['super'] });
    auth.logout();
    logError('Después de salir');

    expect(consoleError).not.toHaveBeenCalled();
  });
});
