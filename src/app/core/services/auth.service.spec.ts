import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const api = environment.apiBaseUrl;
  let auth: AuthService;
  let backend: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('stores both tokens after logging in', () => {
    auth.login({ email: 'ana@botbite.test', password: 'secreta' }).subscribe();

    const req = backend.expectOne(`${api}/auth/login`);
    expect(req.request.body).toEqual({ email: 'ana@botbite.test', password: 'secreta' });
    req.flush({ access_token: 'access-1', refresh_token: 'refresh-1' });

    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.accessToken).toBe('access-1');
    expect(auth.refreshToken).toBe('refresh-1');
  });

  it('loads the profile into the user signal', () => {
    auth.loadProfile().subscribe();

    backend.expectOne(`${api}/auth/validate-token`).flush({
      valid: true,
      user: { id: 'u1', email: 'ana@botbite.test', roles: ['admin'], password: 'nunca' },
    });

    expect(auth.user()).toEqual({ id: 'u1', email: 'ana@botbite.test', roles: ['admin'] });
  });

  it('clears the session and revokes the refresh token on logout', () => {
    localStorage.setItem('botbite.access', 'access-1');
    localStorage.setItem('botbite.refresh', 'refresh-1');
    auth.user.set({ id: 'u1', email: 'ana@botbite.test', roles: ['user'] });

    auth.logout();

    expect(auth.isAuthenticated()).toBeFalse();
    expect(auth.refreshToken).toBeNull();
    expect(auth.user()).toBeNull();
    const req = backend.expectOne(`${api}/auth/logout`);
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    // Si la API no responde, el logout local ya ocurrió y no truena.
    req.flush(null, { status: 500, statusText: 'Server Error' });
  });

  it('does not call the API on logout without a refresh token', () => {
    localStorage.setItem('botbite.access', 'access-1');

    auth.logout();

    backend.expectNone(`${api}/auth/logout`);
    expect(auth.isAuthenticated()).toBeFalse();
  });

  it('announces the end of the session on logout (#40)', () => {
    let ended = 0;
    auth.sessionEnded.subscribe(() => (ended += 1));

    auth.logout();

    expect(ended).toBe(1);
  });
});
