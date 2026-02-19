import { Route } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const appRoutes: Route[] = [
	{
		path: '',
		loadComponent: () => import('./pages/home.page').then((m) => m.HomePage),
	},
	{
		path: 'catalog',
		loadComponent: () =>
			import('./pages/catalog.page').then((m) => m.CatalogPage),
	},
	{
		path: 'products/:id',
		loadComponent: () =>
			import('./pages/product-detail.page').then((m) => m.ProductDetailPage),
	},
	{
		path: 'cart',
		loadComponent: () => import('./pages/cart.page').then((m) => m.CartPage),
	},
	{
		path: 'checkout',
		loadComponent: () =>
			import('./pages/checkout.page').then((m) => m.CheckoutPage),
	},
	{
		path: 'checkout/mp/success',
		loadComponent: () =>
			import('./pages/mercadopago-return.page').then((m) => m.MercadoPagoReturnPage),
		data: { result: 'success' },
	},
	{
		path: 'checkout/mp/pending',
		loadComponent: () =>
			import('./pages/mercadopago-return.page').then((m) => m.MercadoPagoReturnPage),
		data: { result: 'pending' },
	},
	{
		path: 'checkout/mp/failure',
		loadComponent: () =>
			import('./pages/mercadopago-return.page').then((m) => m.MercadoPagoReturnPage),
		data: { result: 'failure' },
	},
	{
		path: 'login',
		loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage),
	},
	{
		path: 'verify-email',
		loadComponent: () =>
			import('./pages/verify-email.page').then((m) => m.VerifyEmailPage),
	},
	{
		path: 'forgot-password',
		loadComponent: () =>
			import('./pages/forgot-password.page').then((m) => m.ForgotPasswordPage),
	},
	{
		path: 'reset-password',
		loadComponent: () =>
			import('./pages/reset-password.page').then((m) => m.ResetPasswordPage),
	},
	{
		path: 'register',
		loadComponent: () =>
			import('./pages/register.page').then((m) => m.RegisterPage),
	},
	{
		path: 'profile',
		canActivate: [authGuard],
		loadComponent: () =>
			import('./pages/profile.page').then((m) => m.ProfilePage),
	},
	{ path: '**', redirectTo: '' },
];
