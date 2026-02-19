import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

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

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-stack">
      <section class="card panel">
        <h2>Restablecer password</h2>

        @if (!token()) {
          <p class="form-alert form-alert--error" role="alert">
            Falta el token de restablecimiento.
          </p>
          <p class="muted"><a routerLink="/forgot-password">Pedir otro link</a></p>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()">
            <label for="password">Nueva password</label>
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
            }

            <button [disabled]="form.invalid || loading()" type="submit">
              {{ loading() ? 'Guardando...' : 'Guardar password' }}
            </button>
          </form>

          @if (done()) {
            <p class="muted" role="status">Password actualizada. Ya podes iniciar sesion.</p>
          }
          @if (error()) {
            <p class="form-alert form-alert--error" role="alert">{{ error() }}</p>
          }

          <p class="muted"><a routerLink="/login">Ir a login</a></p>
        }
      </section>
    </section>
  `,
})
export class ResetPasswordPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  token = signal<string | null>(null);
  loading = signal(false);
  done = signal(false);
  error = signal('');
  submitted = signal(false);
  showPassword = signal(false);

  form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: [passwordMatchValidator] },
  );

  ngOnInit() {
    const token = this.readTokenFromUrl();
    this.token.set(token);
    this.stripSensitiveUrlData();
  }

  submit() {
    if (this.loading()) {
      return;
    }

    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const token = this.token();
    if (!token) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.done.set(false);

    this.api.resetPassword(token, this.form.controls.password.value).subscribe({
      next: () => {
        this.done.set(true);
      },
      error: (err) => {
        this.error.set(this.formatError(err));
      },
      complete: () => {
        this.loading.set(false);
      },
    });
  }

  toggleShowPassword() {
    this.showPassword.update((v) => !v);
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
      return 'No se pudo actualizar la password. Intenta de nuevo.';
    }

    const message = (err.error as { message?: unknown } | null | undefined)?.message;
    const msg = typeof message === 'string' ? message : '';

    if (err.status === 400 && msg.toLowerCase().includes('invalid or expired')) {
      return 'El link es invalido o vencio. Pedi uno nuevo.';
    }

    if (err.status === 0) {
      return 'No pudimos conectar con el servidor. Revisa tu conexion e intenta de nuevo.';
    }

    return 'No se pudo actualizar la password. Intenta de nuevo.';
  }

  private readTokenFromUrl(): string | null {
    const fromQuery = this.route.snapshot.queryParamMap.get('token');
    if (fromQuery?.trim()) {
      return fromQuery.trim();
    }

    if (typeof location === 'undefined') {
      return null;
    }

    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    if (!hash) {
      return null;
    }

    const fromHash = new URLSearchParams(hash).get('token');
    return fromHash?.trim() ? fromHash.trim() : null;
  }

  private stripSensitiveUrlData() {
    if (typeof history === 'undefined' || typeof location === 'undefined') {
      return;
    }

    if (!location.search && !location.hash) {
      return;
    }

    history.replaceState(history.state, '', location.pathname);
  }
}
