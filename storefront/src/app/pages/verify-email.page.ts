import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-stack">
      <section class="card panel">
        <h2>Verificar email</h2>

        @if (loading()) {
          <p class="muted">Verificando...</p>
        } @else if (error()) {
          <p class="form-alert form-alert--error" role="alert">{{ error() }}</p>
        } @else {
          <p class="muted">{{ message() }}</p>
        }

        <p class="muted">
          <a routerLink="/login">Ir a login</a>
        </p>
      </section>
    </section>
  `,
})
export class VerifyEmailPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  loading = signal(true);
  message = signal('Email verificado con exito.');
  error = signal('');

  ngOnInit() {
    const token = this.readTokenFromUrl();
    this.stripSensitiveUrlData();
    if (!token) {
      this.loading.set(false);
      this.error.set('Falta el token de verificacion.');
      return;
    }

    this.api.verifyEmail(token).subscribe({
      next: () => {
        this.message.set('Email verificado con exito. Ya podes usar tu cuenta normalmente.');
        this.error.set('');
      },
      error: () => {
        this.error.set('Token invalido o vencido. Intenta registrarte de nuevo o solicita otro link.');
      },
      complete: () => {
        this.loading.set(false);
      },
    });
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
