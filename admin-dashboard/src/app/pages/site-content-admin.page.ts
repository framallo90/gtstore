import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '../core/admin-api.service';
import { AdminSiteContent } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-stack">
      <section class="card panel panel--xl">
        <header class="page-header">
          <p class="page-header__eyebrow">Contenido</p>
          <h2 class="page-header__title">Textos de la tienda</h2>
          <p class="page-header__copy">
            Edita copys visibles para clientes en Home y Catalogo.
          </p>
        </header>

        @if (loading()) {
          <p class="muted">Cargando contenido...</p>
        } @else {
          <form class="admin-form" [formGroup]="form" (ngSubmit)="save()">
            <div class="admin-form__grid">
              <label>
                <span>Tag del hero</span>
                <input formControlName="homeHeroTag" maxlength="80" />
              </label>

              <label>
                <span>Titulo del hero</span>
                <input formControlName="homeHeroTitle" maxlength="180" />
              </label>
            </div>

            <label>
              <span>Descripcion principal del hero</span>
              <textarea formControlName="homeHeroCopy" maxlength="1200"></textarea>
            </label>

            <div class="admin-form__grid">
              <label>
                <span>Tarjeta oferta - Titulo</span>
                <input formControlName="homeFlashTitle" maxlength="180" />
              </label>

              <label>
                <span>Tarjeta recomendacion - Titulo</span>
                <input formControlName="homeRecoTitle" maxlength="180" />
              </label>
            </div>

            <div class="admin-form__grid">
              <label>
                <span>Tarjeta oferta - Texto</span>
                <textarea formControlName="homeFlashCopy" maxlength="600"></textarea>
              </label>

              <label>
                <span>Tarjeta recomendacion - Texto</span>
                <textarea formControlName="homeRecoCopy" maxlength="600"></textarea>
              </label>
            </div>

            <div class="admin-form__grid">
              <label>
                <span>Titulo de catalogo</span>
                <input formControlName="catalogTitle" maxlength="120" />
              </label>

              <label>
                <span>Texto de catalogo</span>
                <textarea formControlName="catalogCopy" maxlength="600"></textarea>
              </label>
            </div>

            <div class="admin-form__actions">
              <button type="submit" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
              </button>
              <button type="button" (click)="reload()" [disabled]="saving()">Recargar</button>
            </div>
          </form>

          <section class="content-admin-grid">
            <article class="content-admin-panel">
              <h3>Estado publicado actual</h3>
              @if (published(); as current) {
                <dl class="content-admin-definition">
                  <div>
                    <dt>Hero</dt>
                    <dd>{{ current.homeHeroTag }} · {{ current.homeHeroTitle }}</dd>
                  </div>
                  <div>
                    <dt>Descripcion hero</dt>
                    <dd>{{ current.homeHeroCopy }}</dd>
                  </div>
                  <div>
                    <dt>Oferta</dt>
                    <dd>{{ current.homeFlashTitle }} · {{ current.homeFlashCopy }}</dd>
                  </div>
                  <div>
                    <dt>Recomendacion</dt>
                    <dd>{{ current.homeRecoTitle }} · {{ current.homeRecoCopy }}</dd>
                  </div>
                  <div>
                    <dt>Catalogo</dt>
                    <dd>{{ current.catalogTitle }} · {{ current.catalogCopy }}</dd>
                  </div>
                </dl>
              } @else {
                <p class="muted">Sin contenido cargado.</p>
              }
            </article>

            <article class="content-admin-panel">
              <h3>Vista previa en vivo</h3>
              @if (preview(); as draft) {
                <div class="content-admin-preview">
                  <p class="content-admin-preview__tag">{{ draft.homeHeroTag }}</p>
                  <h4>{{ draft.homeHeroTitle }}</h4>
                  <p>{{ draft.homeHeroCopy }}</p>
                  <hr />
                  <p><strong>Oferta:</strong> {{ draft.homeFlashTitle }}</p>
                  <p class="muted">{{ draft.homeFlashCopy }}</p>
                  <p><strong>Recomendacion:</strong> {{ draft.homeRecoTitle }}</p>
                  <p class="muted">{{ draft.homeRecoCopy }}</p>
                  <p><strong>Catalogo:</strong> {{ draft.catalogTitle }}</p>
                  <p class="muted">{{ draft.catalogCopy }}</p>
                </div>
              }
            </article>
          </section>
        }

        @if (error()) {
          <p class="form-alert form-alert--error" role="alert">{{ error() }}</p>
        }

        @if (success()) {
          <p class="form-alert" role="status">{{ success() }}</p>
        }
      </section>
    </section>
  `,
})
export class SiteContentAdminPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);

  loading = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');
  published = signal<AdminSiteContent | null>(null);

  form = this.fb.nonNullable.group({
    homeHeroTag: ['', [Validators.required, Validators.maxLength(80)]],
    homeHeroTitle: ['', [Validators.required, Validators.maxLength(180)]],
    homeHeroCopy: ['', [Validators.required, Validators.maxLength(1200)]],
    homeFlashTitle: ['', [Validators.required, Validators.maxLength(180)]],
    homeFlashCopy: ['', [Validators.required, Validators.maxLength(600)]],
    homeRecoTitle: ['', [Validators.required, Validators.maxLength(180)]],
    homeRecoCopy: ['', [Validators.required, Validators.maxLength(600)]],
    catalogTitle: ['', [Validators.required, Validators.maxLength(120)]],
    catalogCopy: ['', [Validators.required, Validators.maxLength(600)]],
  });

  preview = computed<AdminSiteContent>(() => ({
    homeHeroTag: this.form.controls.homeHeroTag.value.trim(),
    homeHeroTitle: this.form.controls.homeHeroTitle.value.trim(),
    homeHeroCopy: this.form.controls.homeHeroCopy.value.trim(),
    homeFlashTitle: this.form.controls.homeFlashTitle.value.trim(),
    homeFlashCopy: this.form.controls.homeFlashCopy.value.trim(),
    homeRecoTitle: this.form.controls.homeRecoTitle.value.trim(),
    homeRecoCopy: this.form.controls.homeRecoCopy.value.trim(),
    catalogTitle: this.form.controls.catalogTitle.value.trim(),
    catalogCopy: this.form.controls.catalogCopy.value.trim(),
  }));

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    this.api.getSiteContent().subscribe({
      next: (content) => {
        this.applyContent(content);
        this.published.set(content);
      },
      error: (err) => {
        this.error.set(this.formatError(err));
      },
      complete: () => {
        this.loading.set(false);
      },
    });
  }

  save() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    const payload = {
      homeHeroTag: this.form.controls.homeHeroTag.value.trim(),
      homeHeroTitle: this.form.controls.homeHeroTitle.value.trim(),
      homeHeroCopy: this.form.controls.homeHeroCopy.value.trim(),
      homeFlashTitle: this.form.controls.homeFlashTitle.value.trim(),
      homeFlashCopy: this.form.controls.homeFlashCopy.value.trim(),
      homeRecoTitle: this.form.controls.homeRecoTitle.value.trim(),
      homeRecoCopy: this.form.controls.homeRecoCopy.value.trim(),
      catalogTitle: this.form.controls.catalogTitle.value.trim(),
      catalogCopy: this.form.controls.catalogCopy.value.trim(),
    };

    this.api.updateSiteContent(payload).subscribe({
      next: (content) => {
        this.applyContent(content);
        this.published.set(content);
        this.success.set('Textos guardados correctamente.');
      },
      error: (err) => {
        this.error.set(this.formatError(err));
      },
      complete: () => {
        this.saving.set(false);
      },
    });
  }

  private applyContent(content: AdminSiteContent) {
    this.form.setValue({
      homeHeroTag: content.homeHeroTag,
      homeHeroTitle: content.homeHeroTitle,
      homeHeroCopy: content.homeHeroCopy,
      homeFlashTitle: content.homeFlashTitle,
      homeFlashCopy: content.homeFlashCopy,
      homeRecoTitle: content.homeRecoTitle,
      homeRecoCopy: content.homeRecoCopy,
      catalogTitle: content.catalogTitle,
      catalogCopy: content.catalogCopy,
    });
  }

  private formatError(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return 'No pudimos completar la operacion. Intenta de nuevo.';
    }

    const serverMessage = this.extractApiMessage(err);
    if (serverMessage) {
      return serverMessage;
    }

    if (err.status === 0) {
      return 'No pudimos conectar con el servidor. Revisa la conexion.';
    }

    if (err.status === 401 || err.status === 403) {
      return 'Tu usuario no tiene permisos para editar contenido.';
    }

    return 'No pudimos guardar los textos. Intenta de nuevo.';
  }

  private extractApiMessage(err: HttpErrorResponse): string | null {
    const payload = err.error;
    if (!payload) {
      return null;
    }

    if (typeof payload === 'string' && payload.trim().length > 0) {
      return payload.trim();
    }

    if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
      return payload.message.trim();
    }

    if (Array.isArray(payload.message) && payload.message.length > 0) {
      const first = payload.message.find(
        (item: unknown) => typeof item === 'string' && item.trim().length > 0,
      );
      if (first) {
        return first.trim();
      }
    }

    return null;
  }
}
