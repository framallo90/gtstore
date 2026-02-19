import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AnalyticsService } from '../core/analytics.service';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;

  if (typeof password !== 'string' || typeof confirm !== 'string') {
    return null;
  }
  if (!password || !confirm) {
    return null;
  }

  return password === confirm ? null : { passwordMismatch: true };
}

function emailMatchValidator(control: AbstractControl): ValidationErrors | null {
  const email = control.get('email')?.value;
  const confirm = control.get('confirmEmail')?.value;

  if (typeof email !== 'string' || typeof confirm !== 'string') {
    return null;
  }
  if (!email || !confirm) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedConfirm = confirm.trim().toLowerCase();

  return normalizedEmail === normalizedConfirm ? null : { emailMismatch: true };
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-stack">
      <section class="card panel">
        <h2>Crear cuenta</h2>
        <form [formGroup]="form" (ngSubmit)="submit()">
        <label for="firstName">Nombre</label>
        <input
          id="firstName"
          formControlName="firstName"
          autocomplete="given-name"
          [attr.aria-invalid]="firstNameInvalid()"
        />
        @if (firstNameInvalid()) {
          <p class="field-msg field-msg--error">Ingresa tu nombre.</p>
        } @else {
          <p class="field-msg field-msg--hint">Como queres que figure en tus pedidos.</p>
        }

        <label for="lastName">Apellido</label>
        <input
          id="lastName"
          formControlName="lastName"
          autocomplete="family-name"
          [attr.aria-invalid]="lastNameInvalid()"
        />
        @if (lastNameInvalid()) {
          <p class="field-msg field-msg--error">Ingresa tu apellido.</p>
        } @else {
          <p class="field-msg field-msg--hint">Lo usamos para tus comprobantes y pedidos.</p>
        }

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
          <p class="field-msg field-msg--hint">Te enviaremos confirmaciones de compra.</p>
        }

        <label for="confirmEmail">Repetir email</label>
        <input
          id="confirmEmail"
          type="email"
          formControlName="confirmEmail"
          autocomplete="email"
          inputmode="email"
          [attr.aria-invalid]="confirmEmailInvalid()"
        />
        @if (confirmEmailInvalid()) {
          <p class="field-msg field-msg--error">{{ confirmEmailErrorMessage() }}</p>
        } @else {
          <p class="field-msg field-msg--hint">Repetilo para evitar errores.</p>
        }

        <label for="password">Password</label>
        <div class="input-row">
          <input
            id="password"
            [type]="showPassword() ? 'text' : 'password'"
            formControlName="password"
            autocomplete="new-password"
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

        <label for="confirmPassword">Repetir password</label>
        <input
          id="confirmPassword"
          [type]="showPassword() ? 'text' : 'password'"
          formControlName="confirmPassword"
          autocomplete="new-password"
          [attr.aria-invalid]="confirmPasswordInvalid()"
        />
        @if (confirmPasswordInvalid()) {
          <p class="field-msg field-msg--error">{{ confirmPasswordErrorMessage() }}</p>
        } @else {
          <p class="field-msg field-msg--hint">Volvela a escribir para evitar errores.</p>
        }

        <button [disabled]="form.invalid || loading()" type="submit">Crear cuenta</button>
        </form>

        @if (error()) {
          <p class="form-alert form-alert--error" role="alert">{{ error() }}</p>
        }

        <p class="muted">
          Ya tenes cuenta?
          <a
            [routerLink]="['/login']"
            [queryParams]="returnUrl() ? { returnUrl: returnUrl() } : undefined"
            >Iniciar sesion</a
          >
        </p>
      </section>
    </section>
  `,
})
export class RegisterPage {
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

  form = this.fb.nonNullable.group(
    {
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      confirmEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: [passwordMatchValidator, emailMatchValidator] },
  );

  submit() {
    this.submitted.set(true);
    if (this.loading()) {
      return;
    }

    const firstName = this.form.controls.firstName.value.trim();
    const lastName = this.form.controls.lastName.value.trim();
    const email = this.form.controls.email.value.trim().toLowerCase();
    const confirmEmail = this.form.controls.confirmEmail.value.trim().toLowerCase();

    this.form.controls.firstName.setValue(firstName);
    this.form.controls.lastName.setValue(lastName);
    this.form.controls.email.setValue(email);
    this.form.controls.confirmEmail.setValue(confirmEmail);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.api
      .register(
        {
          email,
          password: this.form.controls.password.value,
          firstName,
          lastName,
        },
      )
      .subscribe({
        next: (res) => {
          this.auth.setToken(res.accessToken);
          this.analytics.track('register_success');

          this.cart.syncGuestToServer().subscribe(() => {
            this.router.navigateByUrl(this.returnUrl() ?? '/');
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

  toggleShowPassword() {
    this.showPassword.update((v) => !v);
  }

  firstNameInvalid() {
    const ctrl = this.form.controls.firstName;
    return ctrl.invalid && (ctrl.touched || this.submitted());
  }

  lastNameInvalid() {
    const ctrl = this.form.controls.lastName;
    return ctrl.invalid && (ctrl.touched || this.submitted());
  }

  emailInvalid() {
    const ctrl = this.form.controls.email;
    return ctrl.invalid && (ctrl.touched || this.submitted());
  }

  confirmEmailInvalid() {
    const ctrl = this.form.controls.confirmEmail;
    return (
      (ctrl.invalid || this.form.hasError('emailMismatch')) &&
      (ctrl.touched || this.submitted())
    );
  }

  passwordInvalid() {
    const ctrl = this.form.controls.password;
    return ctrl.invalid && (ctrl.touched || this.submitted());
  }

  confirmPasswordInvalid() {
    const ctrl = this.form.controls.confirmPassword;
    return (
      (ctrl.invalid || this.form.hasError('passwordMismatch')) &&
      (ctrl.touched || this.submitted())
    );
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
    if (errors['emailTaken']) {
      return 'Este email ya esta registrado. Inicia sesion o usa otro.';
    }
    return 'Revisa el email.';
  }

  confirmEmailErrorMessage() {
    const errors = this.form.controls.confirmEmail.errors;
    if (errors?.['required']) {
      return 'Repeti tu email.';
    }
    if (errors?.['email']) {
      return 'Revisa el email. Ejemplo: nombre@dominio.com.';
    }
    if (this.form.hasError('emailMismatch')) {
      return 'Los emails no coinciden.';
    }
    return 'Revisa el email.';
  }

  passwordErrorMessage() {
    const errors = this.form.controls.password.errors;
    if (!errors) {
      return 'Revisa la password.';
    }
    if (errors['required']) {
      return 'Ingresa una password.';
    }
    if (errors['minlength']) {
      return 'La password debe tener al menos 8 caracteres.';
    }
    return 'Revisa la password.';
  }

  confirmPasswordErrorMessage() {
    const errors = this.form.controls.confirmPassword.errors;
    if (errors?.['required']) {
      return 'Repeti la password.';
    }
    if (this.form.hasError('passwordMismatch')) {
      return 'Las passwords no coinciden.';
    }
    return 'Revisa la password.';
  }

  private formatError(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return 'No se pudo crear la cuenta. Intenta de nuevo.';
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

    if (err.status === 400 && messages.some((m) => m.includes('Email already exists'))) {
      const prev = this.form.controls.email.errors ?? {};
      this.form.controls.email.setErrors({ ...prev, emailTaken: true });
      return 'Ese email ya existe. Inicia sesion o usa otro email.';
    }

    if (err.status === 429) {
      return 'Demasiados intentos. Espera un minuto y volve a intentar.';
    }

    if (err.status === 400 && messages.some((m) => m.includes('email must be an email'))) {
      return 'Revisa el email. Ejemplo: nombre@dominio.com.';
    }

    return 'No se pudo crear la cuenta. Intenta de nuevo.';
  }
}
