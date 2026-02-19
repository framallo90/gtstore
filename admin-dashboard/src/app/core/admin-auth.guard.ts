import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AdminAuthService } from './admin-auth.service';

export const adminAuthGuard: CanActivateFn = () => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  if (auth.isLoggedIn() && auth.hasAdminAccess()) {
    return true;
  }
  return auth.ensureSession().pipe(
    map((ok) => (ok && auth.hasAdminAccess() ? true : router.createUrlTree(['/login']))),
  );
};
