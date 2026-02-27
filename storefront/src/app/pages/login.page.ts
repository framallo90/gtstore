import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AnalyticsService } from '../core/analytics.service';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-stack">
      <section class="card panel">
        <h2>Iniciar sesion</h2>
        <form [formGroup]="form" (ngSubmit)="submit()">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          formControlName="email"
          autocomplete="email"
          inputmode="email"
          [attr.aria-invalid]="emailInvalid()"
          [attr.aria-describedby]="emailInvalid() ? 'login-email-error' : 'login-email-hint'"
        />
        @if (emailInvalid()) {
          <p id="login-email-error" class="field-msg field-msg--error">
            {{ emailErrorMessage() }}
          </p>
        } @else {
          <p id="login-email-hint" class="field-msg field-msg--hint">
            Usa el email con el que creaste tu cuenta.
          </p>
        }

        <label for="password">Password</label>
        <div class="input-row">
          <input
            id="password"
            [type]="showPassword() ? 'text' : 'password'"
            formControlName="password"
            autocomplete="current-password"
            [attr.aria-invalid]="passwordInvalid()"
            [attr.aria-describedby]="passwordInvalid() ? 'login-password-error' : 'login-password-hint'"
          />
          <button type="button" (click)="toggleShowPassword()">
            {{ showPassword() ? 'Ocultar' : 'Mostrar' }}
          </button>
        </div>
        @if (passwordInvalid()) {
          <p id="login-password-error" class="field-msg field-msg--error">
            {{ passwordErrorMessage() }}
          </p>
        } @else {
          <p id="login-password-hint" class="field-msg field-msg--hint">
            Minimo 8 caracteres.
          </p>
        }

        <p class="muted">
          <a routerLink="/forgot-password">Olvidaste tu password?</a>
        </p>

        <button [disabled]="form.invalid || loading()" type="submit">
          {{ loading() ? 'Entrando...' : 'Entrar' }}
        </button>
        </form>

        @if (error()) {
          <p class="form-alert form-alert--error" role="alert">{{ error() }}</p>
        }

        <p class="muted">
          No tenes cuenta?
          <a
            [routerLink]="['/register']"
            [queryParams]="returnUrl() ? { returnUrl: returnUrl() } : undefined"
            >Crear cuenta</a
          >
        </p>
      </section>
    </section>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly analytics = inject(AnalyticsService);

  submitted = signal(false);
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  returnUrl = signal<string | null>(
    this.sanitizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
  );

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit() {
    this.submitted.set(true);
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const email = this.form.controls.email.value.trim().toLowerCase();
    this.form.controls.email.setValue(email);

    this.api
      .login({ email, password: this.form.controls.password.value })
      .subscribe({
        next: (res) => {
          this.auth.setToken(res.accessToken);
          this.analytics.track('login_success');
          const hasAdminAccess = res.user.role === 'ADMIN' || res.user.role === 'STAFF';

          this.cart.syncGuestToServer().subscribe({
            next: () => this.navigateAfterLogin(hasAdminAccess),
            error: () => this.navigateAfterLogin(hasAdminAccess),
          });
        },
        error: (err) => {
          this.error.set(this.formatError(err));
          this.loading.set(false);
        },
        complete: () => {
          this.loading.set(false);
        },
      });
  }

  toggleShowPassword() {
    this.showPassword.update((v) => !v);
  }

  emailInvalid() {
    const ctrl = this.form.controls.email;
    return ctrl.invalid && (ctrl.touched || this.submitted());
  }

  passwordInvalid() {
    const ctrl = this.form.controls.password;
    return ctrl.invalid && (ctrl.touched || this.submitted());
  }

  emailErrorMessage() {
    const errors = this.form.controls.email.errors;
    if (!errors) {
      return 'Revisa el email.';
    }
    if (errors['required']) {
      return 'Ingresa tu email.';
    }
    if (errors['email']) {
      return 'Ingresa un email valido (ej: nombre@dominio.com).';
    }
    return 'Revisa el email.';
  }

  passwordErrorMessage() {
    const errors = this.form.controls.password.errors;
    if (!errors) {
      return 'Revisa la password.';
    }
    if (errors['required']) {
      return 'Ingresa tu password.';
    }
    if (errors['minlength']) {
      return 'La password debe tener al menos 8 caracteres.';
    }
    return 'Revisa la password.';
  }

  private sanitizeReturnUrl(input: string | null): string | null {
    if (!input) {
      return null;
    }
    if (!input.startsWith('/')) {
      return null;
    }
    // Block protocol-relative URLs and other weird paths.
    if (input.startsWith('//') || input.includes('\\')) {
      return null;
    }
    return input;
  }

  private formatError(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return 'No se pudo iniciar sesion. Intenta de nuevo.';
    }

    if (err.status === 0) {
      return 'No pudimos conectar con el servidor. Revisa tu conexion e intenta de nuevo.';
    }

    const message = (err.error as { message?: unknown } | null | undefined)?.message;
    const messages = Array.isArray(message)
      ? message.filter((m): m is string => typeof m === 'string')
      : typeof message === 'string'
        ? [message]
        : [];

    if (err.status === 401) {
      return 'Email o password incorrectos. Verifica los datos o crea una cuenta.';
    }

    if (err.status === 429) {
      return 'Demasiados intentos. Espera un minuto y volve a intentar.';
    }

    if (err.status === 400 && messages.some((m) => m.includes('email must be an email'))) {
      return 'Revisa el email. Ejemplo: nombre@dominio.com.';
    }

    if (
      err.status === 400 &&
      messages.some((m) => m.includes('password must be longer than or equal to 8 characters'))
    ) {
      return 'La password debe tener al menos 8 caracteres.';
    }

    return 'No se pudo iniciar sesion. Intenta de nuevo.';
  }

  private navigateAfterLogin(hasAdminAccess: boolean) {
    const returnUrl = this.returnUrl();
    if (hasAdminAccess && !returnUrl) {
      const g = globalThis as unknown as { location?: { assign?: (url: string) => void } };
      const adminUrl = this.auth.getAdminDashboardUrl();
      g.location?.assign?.(adminUrl);
      return;
    }

    this.router.navigateByUrl(returnUrl ?? '/');
  }
}
