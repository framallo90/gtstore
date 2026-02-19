import { Component, Injector, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AnalyticsService } from '../core/analytics.service';
import { CartService } from '../core/cart.service';
import { Product } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-stack">
      <div class="card panel panel--wide">
        <h2>Catalogo</h2>
        <p class="muted">
          Compra rapida: agrega al carrito sin loguearte. Si despues inicias sesion,
          se sincroniza automaticamente.
        </p>

        <div class="filters">
        <label>
          <span>Buscar</span>
          <input
            [value]="q()"
            (input)="setQ($event)"
            placeholder="Titulo, autor, descripcion..."
            autocomplete="off"
            inputmode="search"
          />
        </label>

        <label>
          <span>Tipo</span>
          <select [value]="type()" (change)="setType($event)">
            <option value="">Todos</option>
            <option value="BOOK">Libros</option>
            <option value="COMIC">Comics</option>
          </select>
        </label>

        <label class="checkbox">
          <input
            type="checkbox"
            [checked]="featuredOnly()"
            (change)="featuredOnly.set(($any($event.target)).checked)"
          />
          <span>Solo destacados</span>
        </label>

        <label class="checkbox">
          <input
            type="checkbox"
            [checked]="inStockOnly()"
            (change)="inStockOnly.set(($any($event.target)).checked)"
          />
          <span>En stock</span>
        </label>

        <label>
          <span>Precio</span>
          <div class="filters__row">
            <input
              [value]="minPriceText()"
              (input)="setMinPrice($event)"
              placeholder="Min"
              inputmode="decimal"
            />
            <input
              [value]="maxPriceText()"
              (input)="setMaxPrice($event)"
              placeholder="Max"
              inputmode="decimal"
            />
          </div>
        </label>

        <label>
          <span>Ordenar</span>
          <select [value]="sort()" (change)="sort.set(($any($event.target)).value)">
            <option value="recommended">Recomendados</option>
            <option value="newest">Nuevos</option>
            <option value="price_asc">Precio: menor a mayor</option>
            <option value="price_desc">Precio: mayor a menor</option>
            <option value="title_asc">Nombre: A-Z</option>
          </select>
        </label>

        <div class="filters__meta">
          <span class="muted">
            Mostrando {{ products().length }}@if (hasMore()) {+} resultados
          </span>
          <button type="button" (click)="reset()">Limpiar</button>
        </div>
        </div>
      </div>

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
            <h3>{{ product.title }}</h3>
            <p class="muted">{{ product.author }} - {{ product.type }}</p>
            <p><strong>{{ product.price }} USD</strong></p>
            @if (product.stock > 0) {
              <p class="muted">Stock: {{ product.stock }}</p>
            } @else {
              <p class="muted">Sin stock</p>
            }

            <div class="product-card__actions">
              <a [routerLink]="['/products', product.id]">Ver detalle</a>
              <button
                type="button"
                (click)="add(product)"
                [disabled]="product.stock <= 0"
              >
                Agregar
              </button>
            </div>
          </article>
        } @empty {
          @if (loading()) {
            <p class="muted">Cargando catalogo...</p>
          } @else {
            <p class="muted">No hay resultados con esos filtros.</p>
          }
        }
      </section>

      @if (hasMore()) {
        <div class="catalog__more">
          <button type="button" (click)="loadMore()" [disabled]="loading()">Cargar mas</button>
        </div>
      }
    </section>
  `,
})
export class CatalogPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly cart = inject(CartService);
  private readonly analytics = inject(AnalyticsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  products = signal<Product[]>([]);
  loading = signal(false);
  hasMore = signal(false);

  private readonly take = 24;
  private skip = 0;
  private fetchTimer: number | null = null;
  private fetchSeq = 0;
  private analyticsTimer: number | null = null;

  q = signal('');
  type = signal<'' | Product['type']>('');
  featuredOnly = signal(false);
  inStockOnly = signal(false);
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);
  sort = signal<'recommended' | 'newest' | 'price_asc' | 'price_desc' | 'title_asc'>(
    'recommended',
  );

  minPriceText = computed(() => (this.minPrice() === null ? '' : String(this.minPrice())));
  maxPriceText = computed(() => (this.maxPrice() === null ? '' : String(this.maxPrice())));

  ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    this.q.set(qp.get('q') ?? '');

    const t = qp.get('type');
    if (t === 'BOOK' || t === 'COMIC') {
      this.type.set(t);
    }

    const featured = qp.get('featured');
    this.featuredOnly.set(featured === 'true' || featured === '1');

    const stock = qp.get('stock');
    this.inStockOnly.set(stock === 'true' || stock === '1');

    const min = qp.get('min');
    const max = qp.get('max');
    this.minPrice.set(min ? this.parseMoney(min) : null);
    this.maxPrice.set(max ? this.parseMoney(max) : null);

    const sort = qp.get('sort');
    if (
      sort === 'recommended' ||
      sort === 'newest' ||
      sort === 'price_asc' ||
      sort === 'price_desc' ||
      sort === 'title_asc'
    ) {
      this.sort.set(sort);
    }

    effect(
      () => {
      const queryParams: Record<string, string | null> = {
        q: this.q().trim() || null,
        type: this.type() || null,
        featured: this.featuredOnly() ? 'true' : null,
        stock: this.inStockOnly() ? 'true' : null,
        min: this.minPrice() === null ? null : String(this.minPrice()),
        max: this.maxPrice() === null ? null : String(this.maxPrice()),
        sort: this.sort() === 'recommended' ? null : this.sort(),
      };

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams,
        replaceUrl: true,
      });
      },
      { injector: this.injector },
    );

    effect(
      () => {
        // Any filter change resets pagination and re-fetches from backend (debounced).
        void this.q();
        void this.type();
        void this.featuredOnly();
        void this.inStockOnly();
        void this.minPrice();
        void this.maxPrice();
        void this.sort();

        this.skip = 0;
        this.hasMore.set(false);
        this.scheduleFetch({ reset: true });
        this.scheduleFilterAnalytics();
      },
      { injector: this.injector },
    );

    this.analytics.track('catalog_view');
  }

  add(product: Product) {
    this.cart.add(product, 1);
  }

  loadMore() {
    if (this.loading() || !this.hasMore()) {
      return;
    }
    this.analytics.track('catalog_load_more', { shown: this.products().length });
    this.fetch({ reset: false });
  }

  reset() {
    this.q.set('');
    this.type.set('');
    this.featuredOnly.set(false);
    this.inStockOnly.set(false);
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.sort.set('recommended');
  }

  setQ(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.q.set(value);
  }

  setType(ev: Event) {
    const value = (ev.target as HTMLSelectElement).value ?? '';
    if (value === 'BOOK' || value === 'COMIC') {
      this.type.set(value);
      return;
    }
    this.type.set('');
  }

  setMinPrice(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.minPrice.set(value.trim() ? this.parseMoney(value) : null);
  }

  setMaxPrice(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.maxPrice.set(value.trim() ? this.parseMoney(value) : null);
  }

  private scheduleFetch(opts: { reset: boolean }) {
    if (this.fetchTimer) {
      clearTimeout(this.fetchTimer);
      this.fetchTimer = null;
    }

    const g = globalThis as unknown as { setTimeout?: typeof setTimeout };
    this.fetchTimer = g.setTimeout?.(() => this.fetch(opts), 260) ?? null;
  }

  private fetch(opts: { reset: boolean }) {
    if (this.fetchTimer) {
      clearTimeout(this.fetchTimer);
      this.fetchTimer = null;
    }

    const search = this.q().trim() || undefined;
    const type = this.type() || undefined;
    const featured = this.featuredOnly() ? true : undefined;
    const inStock = this.inStockOnly() ? true : undefined;
    const minPrice = this.minPrice() ?? undefined;
    const maxPrice = this.maxPrice() ?? undefined;
    const sort = this.sort() === 'recommended' ? undefined : this.sort();

    const skip = opts.reset ? 0 : this.skip;

    const seq = ++this.fetchSeq;
    this.loading.set(true);

    this.api
      .getProducts({
        search,
        type,
        featured,
        inStock,
        minPrice: minPrice ?? undefined,
        maxPrice: maxPrice ?? undefined,
        sort,
        take: this.take,
        skip,
      })
      .subscribe({
        next: (res) => {
          if (seq !== this.fetchSeq) {
            return;
          }

          if (opts.reset) {
            this.products.set(res);
          } else {
            this.products.update((current) => [...current, ...res]);
          }

          this.skip = skip + res.length;
          this.hasMore.set(res.length >= this.take);
        },
        error: () => {
          if (seq !== this.fetchSeq) {
            return;
          }
          this.hasMore.set(false);
          this.loading.set(false);
        },
        complete: () => {
          if (seq !== this.fetchSeq) {
            return;
          }
          this.loading.set(false);
        },
      });
  }

  private scheduleFilterAnalytics() {
    if (this.analyticsTimer) {
      clearTimeout(this.analyticsTimer);
      this.analyticsTimer = null;
    }

    const g = globalThis as unknown as { setTimeout?: typeof setTimeout };
    this.analyticsTimer =
      g.setTimeout?.(() => {
        const q = this.q().trim();
        this.analytics.track('catalog_filters', {
          searchUsed: !!q,
          searchLength: q.length,
          type: this.type() || null,
          featuredOnly: this.featuredOnly(),
          inStockOnly: this.inStockOnly(),
          minPrice: this.minPrice(),
          maxPrice: this.maxPrice(),
          sort: this.sort(),
        });
      }, 650) ?? null;
  }

  private parseMoney(input: string): number | null {
    const normalized = input.replace(',', '.').replace(/[^\d.]/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
}
