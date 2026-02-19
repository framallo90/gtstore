import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  Observable,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const rawHttp = new HttpClient(inject(HttpBackend));

  const token = authService.getToken();
  const isRefreshRoute = req.url.includes('/api/auth/refresh');
  const isLoginRoute =
    req.url.includes('/api/auth/login') ||
    req.url.includes('/api/auth/register') ||
    req.url.includes('/api/auth/admin/login');
  const shouldSkipAuthHeader = isRefreshRoute || isLoginRoute;

  const authedReq =
    token && !shouldSkipAuthHeader
      ? req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        })
      : req;

  return next(authedReq).pipe(
    catchError((err) => {
      const httpErr = err as HttpErrorResponse;
      if (httpErr.status !== 401) {
        return throwError(() => httpErr);
      }
      if (shouldSkipAuthHeader) {
        return throwError(() => httpErr);
      }

      return refreshAccessToken(rawHttp, authService).pipe(
        switchMap((newToken) =>
          next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            }),
          ),
        ),
        catchError(() => {
          authService.logout();
          return throwError(() => httpErr);
        }),
      );
    }),
  );
};

let refreshInFlight: Observable<string> | null = null;

function refreshAccessToken(
  http: HttpClient,
  authService: AuthService,
): Observable<string> {
  if (!refreshInFlight) {
    refreshInFlight = http
      .post<{ accessToken: string }>('/api/auth/refresh', {}, { withCredentials: true })
      .pipe(
      map((res) => res.accessToken),
      tap((token) => authService.setToken(token)),
      finalize(() => {
        refreshInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
  return refreshInFlight;
}
