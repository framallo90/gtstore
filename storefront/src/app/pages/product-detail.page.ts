import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AnalyticsService } from '../core/analytics.service';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import { ToastService } from '../core/toast.service';
import { Product, ProductReview } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-stack">
      @if (product(); as p) {
        <section class="card panel panel--wide">
          <h2>{{ p.title }}</h2>
          @if (p.subtitle) {
            <p class="muted">{{ p.subtitle }}</p>
          }
          <p class="muted">
            {{ p.author }} - {{ p.type }}
            @if (p.publisher) {
              <span> - {{ p.publisher }}</span>
            }
          </p>
          <p class="muted">{{ p.description }}</p>

          <ul class="admin-list">
            @if (p.genre) {
              <li><strong>Genero:</strong> {{ p.genre }}</li>
            }
            @if (p.seriesName) {
              <li>
                <strong>Serie:</strong> {{ p.seriesName }}
                @if (p.seriesNumber) { <span>#{{ p.seriesNumber }}</span> }
              </li>
            }
            @if (p.language) {
              <li><strong>Idioma:</strong> {{ p.language }}</li>
            }
            @if (p.binding) {
              <li><strong>Encuadernacion:</strong> {{ p.binding }}</li>
            }
            @if (p.publicationYear) {
              <li><strong>Anio:</strong> {{ p.publicationYear }}</li>
            }
            @if (p.publicationDate) {
              <li><strong>Fecha publicacion:</strong> {{ p.publicationDate | date: 'yyyy-MM-dd' }}</li>
            }
            @if (p.pageCount) {
              <li><strong>Paginas:</strong> {{ p.pageCount }}</li>
            }
            @if (p.edition) {
              <li><strong>Edicion:</strong> {{ p.edition }}</li>
            }
            @if (p.translator) {
              <li><strong>Traductor:</strong> {{ p.translator }}</li>
            }
            @if (p.illustrator) {
              <li><strong>Ilustrador:</strong> {{ p.illustrator }}</li>
            }
            @if (p.narrator) {
              <li><strong>Narrador:</strong> {{ p.narrator }}</li>
            }
            @if (p.editor) {
              <li><strong>Editor:</strong> {{ p.editor }}</li>
            }
            @if (p.originCountry) {
              <li><strong>Origen:</strong> {{ p.originCountry }}</li>
            }
            @if (p.dimensions) {
              <li><strong>Dimensiones:</strong> {{ p.dimensions }}</li>
            }
            @if (p.heightCm || p.widthCm || p.thicknessCm) {
              <li>
                <strong>Medidas (cm):</strong>
                {{ p.heightCm ?? '?' }} x {{ p.widthCm ?? '?' }} x {{ p.thicknessCm ?? '?' }}
              </li>
            }
            @if (p.weightGrams) {
              <li><strong>Peso:</strong> {{ p.weightGrams }} g</li>
            }
            @if (p.conditionLabel) {
              <li><strong>Condicion:</strong> {{ p.conditionLabel }}</li>
            }
            @if (p.isbn) {
              <li><strong>ISBN:</strong> {{ p.isbn }}</li>
            }
            @if (p.isbn10) {
              <li><strong>ISBN-10:</strong> {{ p.isbn10 }}</li>
            }
            @if (p.isbn13) {
              <li><strong>ISBN-13:</strong> {{ p.isbn13 }}</li>
            }
            @if (p.ean) {
              <li><strong>EAN:</strong> {{ p.ean }}</li>
            }
            @if (p.shippingEtaMinDays || p.shippingEtaMaxDays) {
              <li>
                <strong>Entrega estimada:</strong>
                {{ p.shippingEtaMinDays ?? '?' }}-{{ p.shippingEtaMaxDays ?? '?' }} dias
              </li>
            }
          </ul>

          <p><strong>{{ p.price }} USD</strong></p>
          @if (p.stock > 0) {
            <p class="muted">Stock: {{ p.stock }}</p>
          } @else {
            <p class="muted">Sin stock</p>
          }

          <div class="product-detail__actions">
            <button type="button" (click)="addToCart()" [disabled]="p.stock <= 0">
              Agregar al carrito
            </button>
            <button type="button" (click)="buyNow()" [disabled]="p.stock <= 0">
              Comprar ahora
            </button>
            @if (authService.isLoggedIn()) {
              <button type="button" (click)="toggleWishlist()" [disabled]="wishlistBusy()">
                @if (isWishlisted()) { Quitar de favoritos } @else { Agregar a favoritos }
              </button>
            } @else {
              <a class="nav__item" routerLink="/login">Login para favoritos</a>
            }
          </div>
        </section>

        <section class="card panel panel--wide">
          <h3>Resenas</h3>
          <p class="muted">
            @if (reviewsSummaryCount() > 0) {
              {{ reviewsSummaryCount() }} resenas - promedio {{ reviewsSummaryAvg() ?? '-' }}/5
            } @else {
              Aun no hay resenas.
            }
          </p>

          @if (authService.isLoggedIn()) {
            <form (ngSubmit)="submitReview()">
              <label>
                <span>Calificacion (1-5)</span>
                <input
                  [value]="reviewRating()"
                  (input)="setRating($event)"
                  type="number"
                  min="1"
                  max="5"
                />
              </label>

              <label>
                <span>Titulo</span>
                <input [value]="reviewTitle()" (input)="setTitle($event)" placeholder="Titulo breve" />
              </label>

              <label>
                <span>Comentario</span>
                <textarea
                  [value]="reviewComment()"
                  (input)="setComment($event)"
                  placeholder="Conta tu experiencia"
                ></textarea>
              </label>

              <div class="admin-form__actions">
                <button type="submit" [disabled]="reviewBusy()">Guardar resena</button>
              </div>
            </form>
          } @else {
            <p class="muted">Inicia sesion para dejar una resena.</p>
          }

          @if (reviews().length === 0) {
            <p class="muted">Sin comentarios por ahora.</p>
          } @else {
            <ul class="admin-list">
              @for (r of reviews(); track r.id) {
                <li class="admin-list__item">
                  <div class="admin-list__main">
                    <strong>{{ r.user.firstName }} {{ r.user.lastName }}</strong>
                    <span class="muted">{{ r.rating }}/5</span>
                    <span class="muted">{{ r.createdAt | date: 'yyyy-MM-dd' }}</span>
                  </div>
                  @if (r.title) {
                    <p><strong>{{ r.title }}</strong></p>
                  }
                  @if (r.comment) {
                    <p class="muted">{{ r.comment }}</p>
                  }
                  @if (currentUserId() === r.userId) {
                    <div class="admin-list__actions">
                      <button type="button" (click)="removeMyReview()" [disabled]="reviewBusy()">
                        Eliminar mi resena
                      </button>
                    </div>
                  }
                </li>
              }
            </ul>
          }
        </section>
      } @else {
        <section class="card panel">
          <p class="muted">Cargando...</p>
        </section>
      }
    </section>
  `,
})
export class ProductDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  readonly authService = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly analytics = inject(AnalyticsService);

  product = signal<Product | null>(null);
  reviews = signal<ProductReview[]>([]);
  reviewsSummaryCount = signal(0);
  reviewsSummaryAvg = signal<number | null>(null);

  currentUserId = signal<string | null>(null);
  isWishlisted = signal(false);
  wishlistBusy = signal(false);

  reviewRating = signal(5);
  reviewTitle = signal('');
  reviewComment = signal('');
  reviewBusy = signal(false);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.api.getProductById(id).subscribe((res) => {
      this.product.set(res);
      this.analytics.track('product_view', { productId: res.id, type: res.type });
      this.loadReviews(res.id);
      this.loadAuthLinkedData(res.id);
    });
  }

  addToCart() {
    const product = this.product();
    if (!product) {
      return;
    }
    this.cart.add(product, 1);
  }

  buyNow() {
    const product = this.product();
    if (!product) {
      return;
    }
    this.analytics.track('buy_now_click', { productId: product.id });
    this.cart.add(product, 1, { toast: false });
    this.router.navigateByUrl('/checkout');
  }

  toggleWishlist() {
    const product = this.product();
    if (!product || this.wishlistBusy()) {
      return;
    }

    this.wishlistBusy.set(true);
    if (this.isWishlisted()) {
      this.api.removeWishlist(product.id).subscribe({
        next: () => {
          this.isWishlisted.set(false);
          this.toast.show({ message: 'Producto removido de favoritos.', variant: 'success' });
        },
        error: () => {
          this.toast.show({ message: 'No se pudo actualizar favoritos.', variant: 'error' });
        },
        complete: () => {
          this.wishlistBusy.set(false);
        },
      });
      return;
    }

    this.api.addWishlist(product.id).subscribe({
      next: () => {
        this.isWishlisted.set(true);
        this.toast.show({ message: 'Producto agregado a favoritos.', variant: 'success' });
      },
      error: () => {
        this.toast.show({ message: 'No se pudo actualizar favoritos.', variant: 'error' });
      },
      complete: () => {
        this.wishlistBusy.set(false);
      },
    });
  }

  setRating(ev: Event) {
    const value = Number((ev.target as HTMLInputElement).value ?? 5);
    if (!Number.isFinite(value)) {
      this.reviewRating.set(5);
      return;
    }
    this.reviewRating.set(Math.min(5, Math.max(1, Math.trunc(value))));
  }

  setTitle(ev: Event) {
    this.reviewTitle.set((ev.target as HTMLInputElement).value ?? '');
  }

  setComment(ev: Event) {
    this.reviewComment.set((ev.target as HTMLTextAreaElement).value ?? '');
  }

  submitReview() {
    const product = this.product();
    if (!product || this.reviewBusy()) {
      return;
    }

    this.reviewBusy.set(true);

    this.api
      .upsertProductReview(product.id, {
        rating: this.reviewRating(),
        title: this.reviewTitle().trim() || undefined,
        comment: this.reviewComment().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.toast.show({ message: 'Resena guardada.', variant: 'success' });
          this.loadReviews(product.id);
        },
        error: () => {
          this.toast.show({ message: 'No se pudo guardar la resena.', variant: 'error' });
        },
        complete: () => {
          this.reviewBusy.set(false);
        },
      });
  }

  removeMyReview() {
    const product = this.product();
    if (!product || this.reviewBusy()) {
      return;
    }

    this.reviewBusy.set(true);
    this.api.removeMyProductReview(product.id).subscribe({
      next: () => {
        this.toast.show({ message: 'Resena eliminada.', variant: 'success' });
        this.loadReviews(product.id);
      },
      error: () => {
        this.toast.show({ message: 'No se pudo eliminar la resena.', variant: 'error' });
      },
      complete: () => {
        this.reviewBusy.set(false);
      },
    });
  }

  private loadReviews(productId: string) {
    this.api.getProductReviews(productId, { take: 30, skip: 0 }).subscribe({
      next: (res) => {
        this.reviews.set(res.items ?? []);
        this.reviewsSummaryCount.set(Number(res.summary?.count ?? 0));
        this.reviewsSummaryAvg.set(res.summary?.avgRating ?? null);
      },
      error: () => {
        this.reviews.set([]);
        this.reviewsSummaryCount.set(0);
        this.reviewsSummaryAvg.set(null);
      },
    });
  }

  private loadAuthLinkedData(productId: string) {
    if (!this.authService.isLoggedIn()) {
      this.currentUserId.set(null);
      this.isWishlisted.set(false);
      return;
    }

    this.api.me().subscribe({
      next: (me) => {
        this.currentUserId.set(me.id);
      },
      error: () => {
        this.currentUserId.set(null);
      },
    });

    this.api.getWishlist().subscribe({
      next: (items) => {
        this.isWishlisted.set(items.some((item) => item.productId === productId));
      },
      error: () => {
        this.isWishlisted.set(false);
      },
    });
  }
}
