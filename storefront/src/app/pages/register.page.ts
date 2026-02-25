import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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
        <h2>Crear cuenta</h2>
        <form [formGroup]="form" (ngSubmit)="submit()">
        <label for="firstName">Nombre</label>
        <input
          id="firstName"
          formControlName="firstName"
          autocomplete="given-name"
          [attr.aria-invalid]="firstNameInvalid()"
          [attr.aria-errormessage]="firstNameInvalid() ? 'register-first-name-error' : null"
        />
        @if (firstNameInvalid()) {
          <p id="register-first-name-error" class="field-msg field-msg--error">Ingresa tu nombre.</p>
        } @else {
          <p class="field-msg field-msg--hint">Como queres que figure en tus pedidos.</p>
        }

        <label for="lastName">Apellido</label>
        <input
          id="lastName"
          formControlName="lastName"
          autocomplete="family-name"
          [attr.aria-invalid]="lastNameInvalid()"
          [attr.aria-errormessage]="lastNameInvalid() ? 'register-last-name-error' : null"
        />
        @if (lastNameInvalid()) {
          <p id="register-last-name-error" class="field-msg field-msg--error">Ingresa tu apellido.</p>
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
          [attr.aria-errormessage]="emailInvalid() ? 'register-email-error' : null"
        />
        @if (emailInvalid()) {
          <p id="register-email-error" class="field-msg field-msg--error">{{ emailErrorMessage() }}</p>
        } @else {
          <p class="field-msg field-msg--hint">Te enviaremos confirmaciones de compra.</p>
        }

        <label for="password">Password</label>
        <div class="input-row">
          <input
            id="password"
            [type]="showPassword() ? 'text' : 'password'"
            formControlName="password"
            autocomplete="new-password"
            [attr.aria-invalid]="passwordInvalid()"
            [attr.aria-errormessage]="passwordInvalid() ? 'register-password-error' : null"
          />
          <button type="button" (click)="toggleShowPassword()">
            {{ showPassword() ? 'Ocultar' : 'Mostrar' }}
          </button>
        </div>
        @if (passwordInvalid()) {
          <p id="register-password-error" class="field-msg field-msg--error">{{ passwordErrorMessage() }}</p>
        } @else {
          <p class="field-msg field-msg--hint">Minimo 8 caracteres.</p>
        }

        <button [disabled]="form.invalid || loading()" type="submit">Crear cuenta</button>
        </form>

        @if (error()) {
          <p id="register-form-error" class="form-alert form-alert--error" role="alert" tabindex="-1">{{ error() }}</p>
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
      password: ['', [Validators.required, Validators.minLength(8)]],
    },
  );

  submit() {
    this.submitted.set(true);
    if (this.loading()) {
      return;
    }

    const firstName = this.form.controls.firstName.value.trim();
    const lastName = this.form.controls.lastName.value.trim();
    const email = this.form.controls.email.value.trim().toLowerCase();

    this.form.controls.firstName.setValue(firstName);
    this.form.controls.lastName.setValue(lastName);
    this.form.controls.email.setValue(email);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalidField();
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
          this.focusFormError();
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
    if (errors['emailTaken']) {
      return 'Este email ya esta registrado. Inicia sesion o usa otro.';
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

  private focusFirstInvalidField() {
    const fields: ReadonlyArray<{ id: string; invalid: boolean }> = [
      { id: 'firstName', invalid: this.form.controls.firstName.invalid },
      { id: 'lastName', invalid: this.form.controls.lastName.invalid },
      { id: 'email', invalid: this.form.controls.email.invalid },
      { id: 'password', invalid: this.form.controls.password.invalid },
    ];
    const target = fields.find((field) => field.invalid);
    if (!target) {
      return;
    }

    const g = globalThis as unknown as { document?: Document; setTimeout?: typeof setTimeout };
    g.setTimeout?.(() => {
      const node = g.document?.getElementById(target.id);
      if (node instanceof HTMLElement) {
        node.focus();
      }
    }, 0);
  }

  private focusFormError() {
    const g = globalThis as unknown as { document?: Document; setTimeout?: typeof setTimeout };
    g.setTimeout?.(() => {
      const node = g.document?.getElementById('register-form-error');
      if (node instanceof HTMLElement) {
        node.focus();
      }
    }, 0);
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
