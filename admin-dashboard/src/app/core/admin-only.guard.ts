import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AdminAuthService } from './admin-auth.service';

export const adminOnlyGuard: CanActivateFn = () => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  if (auth.isLoggedIn() && auth.hasUserManagementAccess()) {
    return true;
  }

  return auth.ensureSession().pipe(
    map((ok) => {
      if (ok && auth.hasUserManagementAccess()) {
        return true;
      }

      if (ok && auth.hasAdminAccess()) {
        return router.createUrlTree(['/']);
      }

      return router.createUrlTree(['/login']);
    }),
  );
};
