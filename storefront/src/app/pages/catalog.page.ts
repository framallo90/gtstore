import { Component, Injector, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AnalyticsService } from '../core/analytics.service';
import { CartService } from '../core/cart.service';
import { Product, ProductFacets, StorefrontContent } from '../core/models';

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
    <section class="page-stack">
      <div class="card panel panel--xl">
        <h2>{{ content().catalogTitle }}</h2>
        <p class="muted">{{ content().catalogCopy }}</p>

        <div class="filters">
        <label class="filters__search">
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

        <label>
          <span>Editorial</span>
          <input
            [value]="publisher()"
            (input)="setPublisher($event)"
            placeholder="Ej: Planeta, Penguin..."
            autocomplete="off"
          />
        </label>

        <label>
          <span>Genero</span>
          <input
            [value]="genre()"
            (input)="setGenre($event)"
            placeholder="Ej: Fantasia, Manga..."
            autocomplete="off"
          />
        </label>

        <label>
          <span>Serie</span>
          <input
            [value]="seriesName()"
            (input)="setSeriesName($event)"
            placeholder="Ej: Saga Dune"
            autocomplete="off"
          />
        </label>

        <label>
          <span>Idioma</span>
          <select [value]="language()" (change)="setLanguage($event)">
            <option value="">Todos</option>
            @for (option of languageOptions; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </label>

        <label>
          <span>Encuadernacion</span>
          <select [value]="binding()" (change)="setBinding($event)">
            <option value="">Todas</option>
            @for (option of bindingOptions; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </label>

        <label>
          <span>Condicion</span>
          <select [value]="conditionLabel()" (change)="setConditionLabel($event)">
            <option value="">Todas</option>
            @for (option of conditionOptions; track option) {
              <option [value]="option">{{ option }}</option>
            }
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
          <span>Año edicion</span>
          <div class="filters__row">
            <input
              [value]="minYearText()"
              (input)="setMinYear($event)"
              placeholder="Desde"
              inputmode="numeric"
            />
            <input
              [value]="maxYearText()"
              (input)="setMaxYear($event)"
              placeholder="Hasta"
              inputmode="numeric"
            />
          </div>
        </label>

        <label>
          <span>Paginas</span>
          <div class="filters__row">
            <input
              [value]="minPagesText()"
              (input)="setMinPages($event)"
              placeholder="Min"
              inputmode="numeric"
            />
            <input
              [value]="maxPagesText()"
              (input)="setMaxPages($event)"
              placeholder="Max"
              inputmode="numeric"
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

        @if (facets(); as data) {
          <div class="filters__facets">
            @if (data.facets.type.length > 0) {
              <div class="facet-group">
                <span class="facet-group__title">Tipo</span>
                <div class="facet-group__chips">
                  @for (f of data.facets.type; track f.value) {
                    <button
                      type="button"
                      class="facet-chip"
                      [class.facet-chip--active]="type() === f.value"
                      (click)="type.set(type() === f.value ? '' : f.value)"
                    >
                      {{ f.value === 'BOOK' ? 'Libros' : 'Comics' }} ({{ f.count }})
                    </button>
                  }
                </div>
              </div>
            }

            @if (data.facets.language.length > 0) {
              <div class="facet-group">
                <span class="facet-group__title">Idioma</span>
                <div class="facet-group__chips">
                  @for (f of data.facets.language; track f.value) {
                    <button
                      type="button"
                      class="facet-chip"
                      [class.facet-chip--active]="language() === f.value"
                      (click)="language.set(language() === f.value ? '' : f.value)"
                    >
                      {{ f.value }} ({{ f.count }})
                    </button>
                  }
                </div>
              </div>
            }

            @if (data.facets.binding.length > 0) {
              <div class="facet-group">
                <span class="facet-group__title">Encuadernacion</span>
                <div class="facet-group__chips">
                  @for (f of data.facets.binding; track f.value) {
                    <button
                      type="button"
                      class="facet-chip"
                      [class.facet-chip--active]="binding() === f.value"
                      (click)="binding.set(binding() === f.value ? '' : f.value)"
                    >
                      {{ f.value }} ({{ f.count }})
                    </button>
                  }
                </div>
              </div>
            }

            @if (data.facets.conditionLabel.length > 0) {
              <div class="facet-group">
                <span class="facet-group__title">Condicion</span>
                <div class="facet-group__chips">
                  @for (f of data.facets.conditionLabel; track f.value) {
                    <button
                      type="button"
                      class="facet-chip"
                      [class.facet-chip--active]="conditionLabel() === f.value"
                      (click)="conditionLabel.set(conditionLabel() === f.value ? '' : f.value)"
                    >
                      {{ f.value }} ({{ f.count }})
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
        </div>
      </div>

      <section class="grid catalog-grid">
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
            @if (product.subtitle) {
              <p class="muted">{{ product.subtitle }}</p>
            }
            <p class="muted">
              {{ product.author }} - {{ product.type }}
              @if (product.publisher) {
                <span> - {{ product.publisher }}</span>
              }
            </p>
            @if (product.seriesName) {
              <p class="muted">
                Serie: {{ product.seriesName }}
                @if (product.seriesNumber) {
                  <span>#{{ product.seriesNumber }}</span>
                }
              </p>
            }
            @if (product.language || product.binding || product.publicationYear) {
              <p class="muted">
                @if (product.language) {
                  <span>{{ product.language }}</span>
                }
                @if (product.binding) {
                  <span> - {{ product.binding }}</span>
                }
                @if (product.publicationYear) {
                  <span> - {{ product.publicationYear }}</span>
                }
              </p>
            }
            @if (product.conditionLabel) {
              <p class="muted">Condicion: {{ product.conditionLabel }}</p>
            }
            @if (product.shippingEtaMinDays || product.shippingEtaMaxDays) {
              <p class="muted">
                Entrega estimada: {{ product.shippingEtaMinDays ?? '?' }}-{{ product.shippingEtaMaxDays ?? '?' }} dias
              </p>
            }
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
  facets = signal<ProductFacets | null>(null);
  content = signal<StorefrontContent>(DEFAULT_CONTENT);
  loading = signal(false);
  hasMore = signal(false);

  private readonly take = 24;
  private skip = 0;
  private fetchTimer: number | null = null;
  private fetchSeq = 0;
  private analyticsTimer: number | null = null;

  q = signal('');
  type = signal<'' | Product['type']>('');
  publisher = signal('');
  genre = signal('');
  seriesName = signal('');
  language = signal('');
  binding = signal('');
  conditionLabel = signal('');
  featuredOnly = signal(false);
  inStockOnly = signal(false);
  minPrice = signal<number | null>(null);
  maxPrice = signal<number | null>(null);
  minYear = signal<number | null>(null);
  maxYear = signal<number | null>(null);
  minPages = signal<number | null>(null);
  maxPages = signal<number | null>(null);
  sort = signal<'recommended' | 'newest' | 'price_asc' | 'price_desc' | 'title_asc'>(
    'recommended',
  );
  languageOptions = ['Espanol', 'Ingles', 'Portugues', 'Frances', 'Italiano'];
  bindingOptions = [
    'Tapa Blanda',
    'Tapa Dura',
    'Rustica con solapas',
    'Bolsillo',
    'Audiolibro',
  ];
  conditionOptions = ['Nuevo', 'Usado', 'Reacondicionado'];

  minPriceText = computed(() => (this.minPrice() === null ? '' : String(this.minPrice())));
  maxPriceText = computed(() => (this.maxPrice() === null ? '' : String(this.maxPrice())));
  minYearText = computed(() => (this.minYear() === null ? '' : String(this.minYear())));
  maxYearText = computed(() => (this.maxYear() === null ? '' : String(this.maxYear())));
  minPagesText = computed(() => (this.minPages() === null ? '' : String(this.minPages())));
  maxPagesText = computed(() => (this.maxPages() === null ? '' : String(this.maxPages())));

  ngOnInit() {
    this.api.getSiteContent().subscribe({
      next: (content) => this.content.set(content),
      error: () => undefined,
    });

    const qp = this.route.snapshot.queryParamMap;
    this.q.set(qp.get('q') ?? '');

    const t = qp.get('type');
    if (t === 'BOOK' || t === 'COMIC') {
      this.type.set(t);
    }

    this.publisher.set(qp.get('publisher') ?? '');
    this.genre.set(qp.get('genre') ?? '');
    this.seriesName.set(qp.get('seriesName') ?? '');
    this.language.set(qp.get('language') ?? '');
    this.binding.set(qp.get('binding') ?? '');
    this.conditionLabel.set(qp.get('conditionLabel') ?? '');

    const featured = qp.get('featured');
    this.featuredOnly.set(featured === 'true' || featured === '1');

    const stock = qp.get('stock');
    this.inStockOnly.set(stock === 'true' || stock === '1');

    const min = qp.get('min');
    const max = qp.get('max');
    this.minPrice.set(min ? this.parseMoney(min) : null);
    this.maxPrice.set(max ? this.parseMoney(max) : null);

    const minYear = qp.get('minYear');
    const maxYear = qp.get('maxYear');
    this.minYear.set(minYear ? this.parseYear(minYear) : null);
    this.maxYear.set(maxYear ? this.parseYear(maxYear) : null);

    const minPages = qp.get('minPages');
    const maxPages = qp.get('maxPages');
    this.minPages.set(minPages ? this.parsePositiveInt(minPages) : null);
    this.maxPages.set(maxPages ? this.parsePositiveInt(maxPages) : null);

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
        publisher: this.publisher().trim() || null,
        genre: this.genre().trim() || null,
        seriesName: this.seriesName().trim() || null,
        language: this.language().trim() || null,
        binding: this.binding().trim() || null,
        conditionLabel: this.conditionLabel().trim() || null,
        featured: this.featuredOnly() ? 'true' : null,
        stock: this.inStockOnly() ? 'true' : null,
        min: this.minPrice() === null ? null : String(this.minPrice()),
        max: this.maxPrice() === null ? null : String(this.maxPrice()),
        minYear: this.minYear() === null ? null : String(this.minYear()),
        maxYear: this.maxYear() === null ? null : String(this.maxYear()),
        minPages: this.minPages() === null ? null : String(this.minPages()),
        maxPages: this.maxPages() === null ? null : String(this.maxPages()),
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
        void this.publisher();
        void this.genre();
        void this.seriesName();
        void this.language();
        void this.binding();
        void this.conditionLabel();
        void this.featuredOnly();
        void this.inStockOnly();
        void this.minPrice();
        void this.maxPrice();
        void this.minYear();
        void this.maxYear();
        void this.minPages();
        void this.maxPages();
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
    this.publisher.set('');
    this.genre.set('');
    this.seriesName.set('');
    this.language.set('');
    this.binding.set('');
    this.conditionLabel.set('');
    this.featuredOnly.set(false);
    this.inStockOnly.set(false);
    this.minPrice.set(null);
    this.maxPrice.set(null);
    this.minYear.set(null);
    this.maxYear.set(null);
    this.minPages.set(null);
    this.maxPages.set(null);
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

  setPublisher(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.publisher.set(value);
  }

  setGenre(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.genre.set(value);
  }

  setSeriesName(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.seriesName.set(value);
  }

  setLanguage(ev: Event) {
    const value = (ev.target as HTMLSelectElement).value ?? '';
    this.language.set(value);
  }

  setBinding(ev: Event) {
    const value = (ev.target as HTMLSelectElement).value ?? '';
    this.binding.set(value);
  }

  setConditionLabel(ev: Event) {
    const value = (ev.target as HTMLSelectElement).value ?? '';
    this.conditionLabel.set(value);
  }

  setMinPrice(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.minPrice.set(value.trim() ? this.parseMoney(value) : null);
  }

  setMaxPrice(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.maxPrice.set(value.trim() ? this.parseMoney(value) : null);
  }

  setMinYear(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.minYear.set(value.trim() ? this.parseYear(value) : null);
  }

  setMaxYear(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.maxYear.set(value.trim() ? this.parseYear(value) : null);
  }

  setMinPages(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.minPages.set(value.trim() ? this.parsePositiveInt(value) : null);
  }

  setMaxPages(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.maxPages.set(value.trim() ? this.parsePositiveInt(value) : null);
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
    const publisher = this.publisher().trim() || undefined;
    const genre = this.genre().trim() || undefined;
    const seriesName = this.seriesName().trim() || undefined;
    const language = this.language().trim() || undefined;
    const binding = this.binding().trim() || undefined;
    const conditionLabel = this.conditionLabel().trim() || undefined;
    const featured = this.featuredOnly() ? true : undefined;
    const inStock = this.inStockOnly() ? true : undefined;
    const minPrice = this.minPrice() ?? undefined;
    const maxPrice = this.maxPrice() ?? undefined;
    const minYear = this.minYear() ?? undefined;
    const maxYear = this.maxYear() ?? undefined;
    const minPages = this.minPages() ?? undefined;
    const maxPages = this.maxPages() ?? undefined;
    const sort = this.sort() === 'recommended' ? undefined : this.sort();

    const skip = opts.reset ? 0 : this.skip;
    const baseFilters = {
      search,
      type,
      publisher,
      genre,
      seriesName,
      language,
      binding,
      conditionLabel,
      featured,
      inStock,
      minPrice: minPrice ?? undefined,
      maxPrice: maxPrice ?? undefined,
      minYear: minYear ?? undefined,
      maxYear: maxYear ?? undefined,
      minPages: minPages ?? undefined,
      maxPages: maxPages ?? undefined,
    };

    const seq = ++this.fetchSeq;
    this.loading.set(true);

    if (opts.reset) {
      this.api.getProductFacets(baseFilters).subscribe({
        next: (res) => this.facets.set(res),
        error: () => this.facets.set(null),
      });
    }

    this.api
      .getProducts({
        ...baseFilters,
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
          publisher: this.publisher().trim() || null,
          genre: this.genre().trim() || null,
          seriesName: this.seriesName().trim() || null,
          language: this.language().trim() || null,
          binding: this.binding().trim() || null,
          conditionLabel: this.conditionLabel().trim() || null,
          featuredOnly: this.featuredOnly(),
          inStockOnly: this.inStockOnly(),
          minPrice: this.minPrice(),
          maxPrice: this.maxPrice(),
          minYear: this.minYear(),
          maxYear: this.maxYear(),
          minPages: this.minPages(),
          maxPages: this.maxPages(),
          sort: this.sort(),
        });
      }, 650) ?? null;
  }

  private parseMoney(input: string): number | null {
    const normalized = input.replace(',', '.').replace(/[^\d.]/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  private parseYear(input: string): number | null {
    const normalized = input.replace(/[^\d]/g, '');
    const n = Number(normalized);
    if (!Number.isFinite(n)) {
      return null;
    }

    const year = Math.trunc(n);
    if (year <= 0 || year > 3000) {
      return null;
    }
    return year;
  }

  private parsePositiveInt(input: string): number | null {
    const normalized = input.replace(/[^\d]/g, '');
    const n = Number(normalized);
    if (!Number.isFinite(n)) {
      return null;
    }
    const intValue = Math.trunc(n);
    if (intValue <= 0) {
      return null;
    }
    return intValue;
  }
}
