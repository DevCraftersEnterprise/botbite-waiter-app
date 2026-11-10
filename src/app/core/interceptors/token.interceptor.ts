import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

// El token solo viaja a la API: nunca a otro dominio (imágenes, CDNs, etc.).
const isApiRequest = (url: string) =>
  url === environment.apiBaseUrl || url.startsWith(`${environment.apiBaseUrl}/`);

// Un 401 de estas rutas no se arregla renovando la sesión.
const SESSION_ROUTES = ['/auth/login', '/auth/refresh-token', '/auth/logout'];
const isSessionRoute = (url: string) => SESSION_ROUTES.some((route) => url.includes(route));

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) return next(req);

  const auth = inject(AuthService);

  const token = auth.accessToken;
  const withAuth = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(withAuth).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || !auth.refreshToken || isSessionRoute(req.url)) {
        return throwError(() => err);
      }

      // Todas las peticiones que fallan juntas esperan la misma renovación y se
      // reintentan una sola vez con el token nuevo.
      return from(auth.renewAccessToken(token)).pipe(
        switchMap((accessToken) => {
          if (!accessToken) return throwError(() => err);

          return next(req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));
        })
      );
    })
  );
};
