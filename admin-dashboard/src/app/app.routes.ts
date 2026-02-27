import { Route } from '@angular/router';
import { adminAuthGuard } from './core/admin-auth.guard';
import { adminOnlyGuard } from './core/admin-only.guard';

export const appRoutes: Route[] = [
	{
		path: 'login',
		loadComponent: () =>
			import('./pages/admin-login.page').then((m) => m.AdminLoginPage),
	},
	{
		path: '',
		canActivate: [adminAuthGuard],
		loadComponent: () =>
			import('./pages/dashboard.page').then((m) => m.DashboardPage),
	},
	{
		path: 'products',
		canActivate: [adminAuthGuard],
		loadComponent: () =>
			import('./pages/products-admin.page').then((m) => m.ProductsAdminPage),
	},
	{
		path: 'orders',
		canActivate: [adminAuthGuard],
		loadComponent: () =>
			import('./pages/orders-admin.page').then((m) => m.OrdersAdminPage),
	},
	{
		path: 'users',
		canActivate: [adminOnlyGuard],
		loadComponent: () =>
			import('./pages/users-admin.page').then((m) => m.UsersAdminPage),
	},
	{
		path: 'content',
		canActivate: [adminAuthGuard],
		loadComponent: () =>
			import('./pages/site-content-admin.page').then((m) => m.SiteContentAdminPage),
	},
	{ path: '**', redirectTo: '' },
];
