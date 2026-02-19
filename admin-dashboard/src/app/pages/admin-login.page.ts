import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminApiService } from '../core/admin-api.service';
import { AdminAuthService } from '../core/admin-auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="auth-shell">
      <div class="card panel panel--auth">
        <h2>Panel de administracion</h2>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            formControlName="email"
            autocomplete="email"
            inputmode="email"
            [attr.aria-invalid]="emailInvalid()"
          />
          @if (emailInvalid()) {
            <p class="field-msg field-msg--error">{{ emailErrorMessage() }}</p>
          } @else {
            <p class="field-msg field-msg--hint">Solo para usuarios STAFF/ADMIN.</p>
          }

          <label for="password">Password</label>
          <div class="input-row">
            <input
              id="password"
              [type]="showPassword() ? 'text' : 'password'"
              formControlName="password"
              autocomplete="current-password"
              [attr.aria-invalid]="passwordInvalid()"
            />
            <button type="button" (click)="toggleShowPassword()">
              {{ showPassword() ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>
          @if (passwordInvalid()) {
            <p class="field-msg field-msg--error">{{ passwordErrorMessage() }}</p>
          } @else {
            <p class="field-msg field-msg--hint">Minimo 8 caracteres.</p>
          }

          <button [disabled]="form.invalid || loading()" type="submit">
            {{ loading() ? 'Entrando...' : 'Entrar' }}
          </button>
        </form>

        @if (error()) {
          <p class="form-alert form-alert--error" role="alert">{{ error() }}</p>
        }

        <details class="muted">
          <summary>Necesitas un usuario admin?</summary>
          <p>
            En local, define <code>ADMIN_EMAIL</code> y <code>ADMIN_PASSWORD</code> en tu
            <code>.env</code> y ejecuta <code>npm run prisma:seed</code>.
          </p>
        </details>
      </div>
    </section>
  `,
})
export class AdminLoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  submitted = signal(false);
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

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
          if (!this.auth.isTokenAdminOrStaff(res.accessToken)) {
            this.error.set(
              'Este usuario no tiene permisos para acceder al panel (solo STAFF/ADMIN).',
            );
            this.loading.set(false);
            return;
          }

          this.auth.setToken(res.accessToken);
          this.router.navigateByUrl('/');
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

  private formatError(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return 'No se pudo iniciar sesion. Intenta de nuevo.';
    }

    if (err.status === 0) {
      return 'No pudimos conectar con el servidor. Revisa tu conexion e intenta de nuevo.';
    }

    if (err.status === 401) {
      return 'Email o password incorrectos.';
    }

    if (err.status === 429) {
      return 'Demasiados intentos. Espera un minuto y volve a intentar.';
    }

    return 'No se pudo iniciar sesion. Intenta de nuevo.';
  }
}
