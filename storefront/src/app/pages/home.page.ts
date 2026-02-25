import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { CartService } from '../core/cart.service';
import { Product, StorefrontContent } from '../core/models';

const DEFAULT_CONTENT: StorefrontContent = {
  homeHeroTag: 'Geeky Drop de la semana',
  homeHeroTitle: 'Colecciona antes de que desaparezca del stock',
  homeHeroCopy:
    'Catalogo curado, compra rapida en mobile y carrito sincronizado aunque el cliente no inicie sesion. Llevate ediciones limitadas sin friccion.',
  homeFlashTitle: 'Hasta 25% en comics seleccionados',
  homeFlashCopy: 'Solo por tiempo limitado en el catalogo destacado.',
  homeRecoTitle: 'Armamos tu carrito ideal por fandom',
  homeRecoCopy: 'Explora por genero, autor, precio y disponibilidad real.',
  catalogTitle: 'Catalogo',
  catalogCopy:
    'Compra rapida: agrega al carrito sin loguearte. Si despues inicias sesion, se sincroniza automaticamente.',
};

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="hero hero--marketing">
      <div class="hero__card hero__card--primary">
        <p class="hero__tag">{{ content().homeHeroTag }}</p>
        <h2 class="hero__title">{{ content().homeHeroTitle }}</h2>
        <p class="hero__copy">{{ content().homeHeroCopy }}</p>

        <form class="hero-search" (submit)="onHeroSearchSubmit($event)">
          <label class="sr-only" for="heroSearchInput">Buscar en catalogo</label>
          <input
            id="heroSearchInput"
            [value]="heroSearch()"
            (input)="setHeroSearch($event)"
            type="search"
            inputmode="search"
            placeholder="Busca por titulo, autor o editorial"
            autocomplete="off"
          />
          <button type="submit">Buscar ahora</button>
        </form>

        <div class="hero__actions">
          <a class="nav__item nav__item--cta" routerLink="/catalog">Quiero ver el catalogo</a>
          <a class="nav__item" routerLink="/checkout">Finalizar compra rapida</a>
        </div>

        <ul class="hero__trust" aria-label="Beneficios clave">
          @for (item of trustItems; track item.title) {
            <li class="hero__trust-item">
              <strong>{{ item.title }}</strong>
              <span>{{ item.copy }}</span>
            </li>
          }
        </ul>
      </div>
      <aside class="hero__showcase" aria-label="Ofertas y categorias destacadas">
        <article class="showcase-card showcase-card--media">
          <p class="showcase-card__label">Coleccion visual</p>
          @if (heroVisualProducts().length > 0) {
            <div class="hero-media-grid">
              @for (item of heroVisualProducts(); track item.id) {
                <figure class="hero-media-grid__item">
                  @if (item.coverUrl) {
                    <img [src]="item.coverUrl" [alt]="'Portada de ' + item.title" loading="lazy" />
                  } @else {
                    <div class="hero-media-grid__placeholder" aria-hidden="true"></div>
                  }
                </figure>
              }
            </div>
          } @else {
            <div class="hero-media-skeleton" aria-hidden="true"></div>
          }
        </article>

        <article class="showcase-card showcase-card--hot">
          <p class="showcase-card__label">Oferta flash</p>
          <h3>{{ content().homeFlashTitle }}</h3>
          <p class="muted">{{ content().homeFlashCopy }}</p>
          <a class="showcase-card__link" routerLink="/catalog" [queryParams]="{ type: 'COMIC' }">
            Ver comics en promo
          </a>
        </article>

        <article class="showcase-card">
          <p class="showcase-card__label">Recomendacion IA</p>
          <h3>{{ content().homeRecoTitle }}</h3>
          <p class="muted">{{ content().homeRecoCopy }}</p>
          <a class="showcase-card__link" routerLink="/catalog" [queryParams]="{ sort: 'recommended' }">
            Explorar recomendados
          </a>
        </article>
      </aside>
    </section>

    <section class="promo-strip" aria-label="Propuesta de valor">
      <div class="promo-strip__inner">
        <span class="promo-chip">Novedades semanales</span>
        <span class="promo-chip">Stock en tiempo real</span>
        <span class="promo-chip">Checkout express</span>
        <span class="promo-chip">Mercado Pago integrado</span>
      </div>
    </section>

    <section class="collections" aria-label="Accesos rapidos">
      <header class="section-head">
        <h3>Entradas rapidas al catalogo</h3>
        <p class="muted">Filtros pensados para decidir y comprar en menos tiempo.</p>
      </header>
      <div class="collections__grid">
        @for (entry of quickCollections; track entry.title) {
          <a
            class="card collection-card"
            [routerLink]="entry.href"
            [queryParams]="entry.query"
          >
            <span class="collection-card__icon" aria-hidden="true">{{ entry.icon }}</span>
            <p class="collection-card__eyebrow">{{ entry.badge }}</p>
            <h3>{{ entry.title }}</h3>
            <p class="muted">{{ entry.copy }}</p>
            <span class="collection-card__cta">Entrar</span>
          </a>
        }
      </div>
    </section>

    <section class="home-products" aria-label="Destacados">
      <header class="section-head">
        <h3>Seleccionados para convertir rapido</h3>
        <p class="muted">Productos con mejor respuesta de compra en la tienda.</p>
      </header>

      @if (productsLoading()) {
        <section class="grid" aria-label="Cargando destacados">
          @for (ghost of skeletonCards; track ghost) {
            <article class="card product-card product-card--skeleton">
              <div class="product-card__media skeleton-row"></div>
              <div class="product-card__skeleton-line"></div>
              <div class="product-card__skeleton-line product-card__skeleton-line--short"></div>
              <div class="product-card__skeleton-line"></div>
            </article>
          }
        </section>
      } @else {
        <section class="grid">
          @for (product of products(); track product.id) {
            <article class="card product-card">
              <div class="product-card__media">
                @if (product.coverUrl) {
                  <img class="product-card__img" [src]="product.coverUrl" [alt]="product.title" />
                } @else {
                  <div class="product-card__placeholder" aria-hidden="true"></div>
                }
              </div>
              <p class="product-card__meta">
                <span class="product-card__type">
                  {{ product.type === 'BOOK' ? 'Libro' : 'Comic' }}
                </span>
                @if (product.isFeatured) {
                  <span class="product-card__type product-card__type--featured">Destacado</span>
                }
              </p>
              <h3>{{ product.title }}</h3>
              <p class="muted">{{ product.author }}</p>

              <div class="product-card__footer">
                <p class="product-card__price"><strong>{{ product.price }} USD</strong></p>
                @if (product.stock > 0) {
                  <p
                    class="stock-pill"
                    [class.stock-pill--ok]="product.stock > 10"
                    [class.stock-pill--medium]="product.stock > 5 && product.stock <= 10"
                    [class.stock-pill--low]="product.stock <= 5"
                  >
                    {{ stockLabel(product.stock) }}
                  </p>
                } @else {
                  <p class="stock-pill stock-pill--none">Sin stock</p>
                }
              </div>

              @if (product.stock > 0) {
                <div class="product-card__actions">
                  <a [routerLink]="['/products', product.id]">Ver detalle</a>
                  <button type="button" (click)="add(product)">Agregar</button>
                </div>
              } @else {
                <div class="product-card__actions">
                  <a [routerLink]="['/products', product.id]">Ver detalle</a>
                  <button type="button" (click)="add(product)" disabled>Sin stock</button>
                </div>
              }
            </article>
          }
        </section>
      }
    </section>
  `,
})
export class HomePage implements OnInit {
  products = signal<Product[]>([]);
  productsLoading = signal(true);
  content = signal<StorefrontContent>(DEFAULT_CONTENT);
  heroSearch = signal('');
  heroVisualProducts = computed(() => this.products().slice(0, 3));
  skeletonCards = [1, 2, 3, 4];
  trustItems = [
    {
      title: 'Checkout agil',
      copy: 'Menos pasos, mas conversion.',
    },
    {
      title: 'Carrito persistente',
      copy: 'Se mantiene en invitados y usuarios.',
    },
    {
      title: 'Pago Mercado Pago',
      copy: 'Flujo seguro y validado.',
    },
  ];
  quickCollections = [
    {
      badge: 'Recien subidos',
      icon: 'NEW',
      title: 'Nuevos ingresos',
      copy: 'Explora lo ultimo agregado esta semana.',
      href: '/catalog',
      query: { sort: 'newest' },
    },
    {
      badge: 'Alta conversion',
      icon: 'TOP',
      title: 'Top recomendados',
      copy: 'Productos con mejor engagement y recompra.',
      href: '/catalog',
      query: { sort: 'recommended', featured: 'true' },
    },
    {
      badge: 'Compra veloz',
      icon: 'NOW',
      title: 'En stock ahora',
      copy: 'Solo resultados listos para despacho inmediato.',
      href: '/catalog',
      query: { stock: 'true' },
    },
  ];

  private readonly api = inject(ApiService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  ngOnInit() {
    this.api.getSiteContent().subscribe({
      next: (content) => this.content.set(content),
      error: () => undefined,
    });

    this.productsLoading.set(true);
    this.api.getFeaturedProducts().subscribe({
      next: (res) => this.products.set(res),
      error: () => this.products.set([]),
      complete: () => this.productsLoading.set(false),
    });
  }

  add(product: Product) {
    this.cart.add(product, 1);
  }

  setHeroSearch(event: Event) {
    const input = event.target as HTMLInputElement | null;
    this.heroSearch.set(input?.value ?? '');
  }

  onHeroSearchSubmit(event: Event) {
    event.preventDefault();
    const value = this.heroSearch().trim();
    this.router.navigate(['/catalog'], {
      queryParams: value ? { q: value } : {},
    });
  }

  stockLabel(stock: number) {
    if (stock > 10) {
      return 'En stock';
    }
    if (stock <= 5) {
      return `Solo quedan ${stock}`;
    }
    return 'Ultimas unidades';
  }
}
