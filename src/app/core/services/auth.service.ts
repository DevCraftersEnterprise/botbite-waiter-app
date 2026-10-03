import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { catchError, EMPTY, map, Observable, tap } from 'rxjs';
import { LoginDto, LoginRes, UserProfile, ValidateTokenRes } from './types/auth.types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private LS_ACCESS = 'botbite.access';
  private LS_REFRESH = 'botbite.refresh';
  apiUrl = environment.apiBaseUrl;

  user = signal<UserProfile | null>(null);

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

  logout() {
    const refreshToken = this.refreshToken;

    localStorage.removeItem(this.LS_ACCESS);
    localStorage.removeItem(this.LS_REFRESH);
    this.user.set(null);

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

  private setTokens(res: LoginRes) {
    if (res?.access_token) localStorage.setItem(this.LS_ACCESS, res.access_token);
    if (res?.refresh_token) localStorage.setItem(this.LS_REFRESH, res.refresh_token);
  }
}
