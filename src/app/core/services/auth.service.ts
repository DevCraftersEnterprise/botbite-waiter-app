import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { catchError, EMPTY, firstValueFrom, map, Observable, Subject, tap, timeout } from 'rxjs';
import {
  LoginDto,
  LoginRes,
  RefreshTokenRes,
  UserProfile,
  ValidateTokenRes,
} from './types/auth.types';

/** Candado que comparten las pestañas del panel para renovar la sesión. */
const REFRESH_LOCK = 'botbite.refresh-session';

/** Si la API no contesta, las demás pestañas no se quedan esperando el candado. */
const REFRESH_TIMEOUT_MS = 20_000;

/**
 * La API rechazó el refresh token (vencido, revocado o de otra sesión).
 * Un corte de red, un 5xx o un 429 no cierran la sesión: se reintenta después.
 */
const isSessionRejected = (err: unknown): boolean =>
  err instanceof HttpErrorResponse &&
  err.status >= 400 &&
  err.status < 500 &&
  err.status !== 408 &&
  err.status !== 429;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private LS_ACCESS = 'botbite.access';
  private LS_REFRESH = 'botbite.refresh';
  apiUrl = environment.apiBaseUrl;

  user = signal<UserProfile | null>(null);

  /** La renovación en curso en esta pestaña: las peticiones que fallan juntas la esperan. */
  private renewing: Promise<string | null> | null = null;

  private readonly sessionEndedSubject = new Subject<void>();
  /**
   * Avisa que se cerró la sesión (con el botón o porque la API rechazó la
   * renovación). La conexión en vivo y la sucursal elegida eran del usuario
   * anterior: `SocketService` y `OrgService` las sueltan (issue #40).
   */
  readonly sessionEnded = this.sessionEndedSubject.asObservable();

  login(payload: LoginDto) {
    return this.http
      .post<LoginRes>(`${this.apiUrl}/auth/login`, payload)
      .pipe(tap((res) => this.setTokens(res)));
  }

  loadProfile(): Observable<UserProfile> {
    return this.http.get<ValidateTokenRes>(`${this.apiUrl}/auth/validate-token`).pipe(
      map(
        (res) =>
          ({
            id: res.user.id,
            email: res.user.email,
            roles: res.user.roles,
          } as UserProfile)
      ),
      tap((profile) => this.user.set(profile))
    );
  }

  /**
   * Da un access token nuevo después de un 401, sin gastar dos veces el mismo
   * refresh token. La API rota el refresh token en cada uso, y si alguien
   * reutiliza uno ya usado, lo toma como robo y cierra todas las sesiones del
   * usuario. Por eso:
   * - en una pestaña, las peticiones que fallan juntas esperan una sola renovación;
   * - entre pestañas, un candado del navegador deja renovar a una sola a la vez;
   * - si otra pestaña ya renovó, se usa el token que dejó, sin llamar a la API.
   *
   * @param failedToken el access token con el que falló la petición.
   * @returns el token para reintentar, o null si la sesión ya no sirve (y la cierra).
   *   Si la API no contesta, rechaza con ese error y la sesión sigue abierta.
   */
  renewAccessToken(failedToken: string | null): Promise<string | null> {
    const current = this.accessToken;
    if (current && current !== failedToken) return Promise.resolve(current);

    this.renewing ??= this.withRefreshLock(() => this.renewOnce(failedToken)).finally(() => {
      this.renewing = null;
    });
    return this.renewing;
  }

  logout() {
    const refreshToken = this.refreshToken;

    localStorage.removeItem(this.LS_ACCESS);
    localStorage.removeItem(this.LS_REFRESH);
    this.user.set(null);
    this.sessionEndedSubject.next();

    // Revoca la sesión en la API para que el refresh token no pueda reutilizarse.
    if (refreshToken) {
      this.http
        .post(`${this.apiUrl}/auth/logout`, { refreshToken })
        .pipe(catchError(() => EMPTY))
        .subscribe();
    }
  }

  get accessToken(): string | null {
    return localStorage.getItem(this.LS_ACCESS);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(this.LS_REFRESH);
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  private async renewOnce(failedToken: string | null): Promise<string | null> {
    // Mientras esperaba el candado, otra pestaña pudo haber renovado.
    const current = this.accessToken;
    if (current && current !== failedToken) return current;

    const refreshToken = this.refreshToken;
    if (!refreshToken) return null;

    let res: RefreshTokenRes;
    try {
      res = await firstValueFrom(
        this.http
          .post<RefreshTokenRes>(`${this.apiUrl}/auth/refresh-token`, { refreshToken })
          .pipe(timeout({ first: REFRESH_TIMEOUT_MS }))
      );
    } catch (err) {
      if (!isSessionRejected(err)) throw err;
      this.logout();
      return null;
    }

    const accessToken = res?.accessToken ?? res?.access_token;
    const nextRefreshToken = res?.refreshToken ?? res?.refresh_token;

    if (!accessToken) {
      this.logout();
      return null;
    }

    localStorage.setItem(this.LS_ACCESS, accessToken);
    // La API rota el refresh token en cada uso: el anterior ya no sirve.
    if (nextRefreshToken) localStorage.setItem(this.LS_REFRESH, nextRefreshToken);
    return accessToken;
  }

  /** Sin Web Locks (navegadores viejos), renueva sin coordinarse con otras pestañas. */
  private withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (!locks?.request) return task();
    // `request` devuelve lo que devuelve la tarea cuando suelta el candado.
    return locks.request(REFRESH_LOCK, task) as Promise<T>;
  }

  private setTokens(res: LoginRes) {
    if (res?.access_token) localStorage.setItem(this.LS_ACCESS, res.access_token);
    if (res?.refresh_token) localStorage.setItem(this.LS_REFRESH, res.refresh_token);
  }
}
