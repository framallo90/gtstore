import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.isLoggedIn()) {
    return true;
  }
  return authService.ensureSession().pipe(
    map((ok) =>
      ok
        ? true
        : router.createUrlTree(['/login'], {
            queryParams: { returnUrl: state.url },
          }),
    ),
  );
};
