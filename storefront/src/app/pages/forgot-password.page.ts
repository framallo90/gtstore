import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-stack">
      <section class="card panel">
        <h2>Recuperar password</h2>

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
            <p class="field-msg field-msg--hint">Te enviaremos un link para restablecer tu password.</p>
          }

          <button [disabled]="form.invalid || loading()" type="submit">
            {{ loading() ? 'Enviando...' : 'Enviar link' }}
          </button>
        </form>

        @if (done()) {
          <p class="muted" role="status">
            Si el email existe, te enviamos un link para restablecer tu password.
          </p>
        }

        @if (error()) {
          <p class="form-alert form-alert--error" role="alert">{{ error() }}</p>
        }

        <p class="muted">
          <a routerLink="/login">Volver a login</a>
        </p>
      </section>
    </section>
  `,
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  loading = signal(false);
  done = signal(false);
  error = signal('');
  submitted = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit() {
    this.submitted.set(true);
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    const email = this.form.controls.email.value.trim().toLowerCase();
    this.form.controls.email.setValue(email);

    this.loading.set(true);
    this.error.set('');
    this.done.set(false);

    this.api.requestPasswordReset(email).subscribe({
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

  emailInvalid() {
    const ctrl = this.form.controls.email;
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

  private formatError(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return 'No se pudo enviar el link. Intenta de nuevo.';
    }
    if (err.status === 0) {
      return 'No pudimos conectar con el servidor. Revisa tu conexion e intenta de nuevo.';
    }
    return 'No se pudo enviar el link. Intenta de nuevo.';
  }
}
