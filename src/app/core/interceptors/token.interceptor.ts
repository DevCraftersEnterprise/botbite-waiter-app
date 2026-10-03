import { HttpClient, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

let isRefreshing = false;

interface RefreshTokenResponse {
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
}

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const http = inject(HttpClient);

  const token = auth.accessToken;
  const withAuth = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(withAuth).pipe(
    catchError((err: HttpErrorResponse) => {
      if (
        err.status === 401 &&
        auth.refreshToken &&
        !isRefreshing &&
        !req.url.includes('/auth/refresh-token')
      ) {
        isRefreshing = true;

        return http
          .post<RefreshTokenResponse>(`${environment.apiBaseUrl}/auth/refresh-token`, {
            refreshToken: auth.refreshToken,
          })
          .pipe(
            switchMap((res) => {
              isRefreshing = false;

              const accessToken = res?.accessToken ?? res?.access_token;
              const refreshToken = res?.refreshToken ?? res?.refresh_token;

              if (accessToken) {
                localStorage.setItem('botbite.access', accessToken);
                // La API rota el refresh token en cada uso: el anterior ya no sirve.
                if (refreshToken) localStorage.setItem('botbite.refresh', refreshToken);

                const retried = req.clone({
                  setHeaders: { Authorization: `Bearer ${accessToken}` },
                });
                return next(retried);
              }

              auth.logout();
              return throwError(() => err);
            }),
            catchError((refreshErr) => {
              isRefreshing = false;
              auth.logout();
              return throwError(() => refreshErr);
            })
          );
      }

      return throwError(() => err);
    })
  );
};
