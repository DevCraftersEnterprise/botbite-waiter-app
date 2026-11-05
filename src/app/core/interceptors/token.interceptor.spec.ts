import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { tokenInterceptor } from './token.interceptor';

describe('tokenInterceptor', () => {
  const api = environment.apiBaseUrl;
  const unauthorized = { status: 401, statusText: 'Unauthorized' };
  let http: HttpClient;
  let backend: HttpTestingController;

  const session = (access: string, refresh?: string) => {
    localStorage.setItem('botbite.access', access);
    if (refresh) localStorage.setItem('botbite.refresh', refresh);
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([tokenInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
  });

  it('sends the access token to the API', () => {
    session('access-1');
    http.get(`${api}/orders/active`).subscribe();

    const req = backend.expectOne(`${api}/orders/active`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({});
  });

  it('sends no header without a session', () => {
    http.get(`${api}/orders/active`).subscribe();

    const req = backend.expectOne(`${api}/orders/active`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('never sends the token to another domain', () => {
    session('access-1', 'refresh-1');
    const urls = ['https://res.cloudinary.com/demo/menu.pdf', `${api}.evil.test/orders`];
    urls.forEach((url) => http.get(url).subscribe({ error: () => undefined }));

    urls.forEach((url) => {
      const req = backend.expectOne(url);
      expect(req.request.headers.has('Authorization')).toBeFalse();
      // Un 401 de otro dominio tampoco gasta el refresh token.
      req.flush(null, unauthorized);
    });
    backend.expectNone(`${api}/auth/refresh-token`);
  });

  it('refreshes once on 401, keeps the rotated refresh token and retries', () => {
    session('old-access', 'old-refresh');
    let body: unknown;
    http.get(`${api}/orders/summary`).subscribe((res) => (body = res));

    backend.expectOne(`${api}/orders/summary`).flush(null, unauthorized);

    const refresh = backend.expectOne(`${api}/auth/refresh-token`);
    expect(refresh.request.method).toBe('POST');
    expect(refresh.request.body).toEqual({ refreshToken: 'old-refresh' });
    refresh.flush({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    const retried = backend.expectOne(`${api}/orders/summary`);
    expect(retried.request.headers.get('Authorization')).toBe('Bearer new-access');
    retried.flush({ ok: true });

    expect(body).toEqual({ ok: true });
    expect(localStorage.getItem('botbite.access')).toBe('new-access');
    expect(localStorage.getItem('botbite.refresh')).toBe('new-refresh');
  });

  it('accepts the snake_case refresh response', () => {
    session('old-access', 'old-refresh');
    http.get(`${api}/orders/summary`).subscribe();

    backend.expectOne(`${api}/orders/summary`).flush(null, unauthorized);
    backend
      .expectOne(`${api}/auth/refresh-token`)
      .flush({ access_token: 'new-access', refresh_token: 'new-refresh' });
    backend.expectOne(`${api}/orders/summary`).flush({});

    expect(localStorage.getItem('botbite.access')).toBe('new-access');
    expect(localStorage.getItem('botbite.refresh')).toBe('new-refresh');
  });

  it('logs out and revokes the session when the refresh fails', () => {
    session('old-access', 'old-refresh');
    let error: HttpErrorResponse | undefined;
    http.get(`${api}/orders/summary`).subscribe({ error: (e) => (error = e) });

    backend.expectOne(`${api}/orders/summary`).flush(null, unauthorized);
    backend.expectOne(`${api}/auth/refresh-token`).flush(null, unauthorized);

    const logout = backend.expectOne(`${api}/auth/logout`);
    expect(logout.request.body).toEqual({ refreshToken: 'old-refresh' });
    logout.flush({});

    expect(error?.status).toBe(401);
    expect(localStorage.getItem('botbite.access')).toBeNull();
    expect(localStorage.getItem('botbite.refresh')).toBeNull();
  });

  it('logs out when the refresh response has no access token', () => {
    session('old-access', 'old-refresh');
    let error: HttpErrorResponse | undefined;
    http.get(`${api}/orders/summary`).subscribe({ error: (e) => (error = e) });

    backend.expectOne(`${api}/orders/summary`).flush(null, unauthorized);
    backend.expectOne(`${api}/auth/refresh-token`).flush({});
    backend.expectOne(`${api}/auth/logout`).flush({});

    expect(error?.status).toBe(401);
    expect(localStorage.getItem('botbite.access')).toBeNull();
  });

  it('passes other errors through without refreshing', () => {
    session('access-1', 'refresh-1');
    let error: HttpErrorResponse | undefined;
    http.get(`${api}/orders/summary`).subscribe({ error: (e) => (error = e) });

    backend
      .expectOne(`${api}/orders/summary`)
      .flush(null, { status: 403, statusText: 'Forbidden' });

    backend.expectNone(`${api}/auth/refresh-token`);
    expect(error?.status).toBe(403);
    expect(localStorage.getItem('botbite.access')).toBe('access-1');
  });

  it('does not refresh without a refresh token', () => {
    session('access-1');
    let error: HttpErrorResponse | undefined;
    http.get(`${api}/orders/summary`).subscribe({ error: (e) => (error = e) });

    backend.expectOne(`${api}/orders/summary`).flush(null, unauthorized);

    backend.expectNone(`${api}/auth/refresh-token`);
    expect(error?.status).toBe(401);
  });
});
