import { Route } from '@angular/router';
import { adminAuthGuard } from './core/admin-auth.guard';

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
		canActivate: [adminAuthGuard],
		loadComponent: () =>
			import('./pages/users-admin.page').then((m) => m.UsersAdminPage),
	},
	{ path: '**', redirectTo: '' },
];
