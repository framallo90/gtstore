import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../core/admin-api.service';
import type { AuditLog, CachedError } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-stack">
      <header class="card page-header">
        <p class="page-header__eyebrow">Admin</p>
        <h2 class="page-header__title">Dashboard</h2>
        <p class="page-header__copy">
          Resumen operativo con ventas, conversion, eventos y salud de la plataforma.
        </p>
        <div class="dashboard__toolbar">
          <p class="muted">Analitica</p>
          <div class="segmented" role="group" aria-label="Ventana de analitica">
            <button
              type="button"
              [class.is-active]="analyticsDays() === 7"
              (click)="setAnalyticsDays(7)"
            >
              7d
            </button>
            <button
              type="button"
              [class.is-active]="analyticsDays() === 30"
              (click)="setAnalyticsDays(30)"
            >
              30d
            </button>
          </div>
        </div>
      </header>

      <section class="grid">
        <article class="card metric-card">
          <h3>Ordenes</h3>
          <p class="metric-card__value">{{ ordersCount() }}</p>
        </article>
        <article class="card metric-card">
          <h3>Ventas</h3>
          <p class="metric-card__value">{{ revenue() }} USD</p>
        </article>
        <article class="card metric-card">
          <h3>Visitantes ({{ analyticsDays() }}d)</h3>
          <p class="metric-card__value">{{ uniqueVisitors() }}</p>
        </article>
        <article class="card metric-card">
          <h3>Sesiones ({{ analyticsDays() }}d)</h3>
          <p class="metric-card__value">{{ uniqueSessions() }}</p>
        </article>
        <article class="card">
          <h3>Funnel ({{ analyticsDays() }}d)</h3>
          <p class="muted">Carritos: <strong>{{ addToCart() }}</strong></p>
          <p class="muted">Checkouts: <strong>{{ beginCheckout() }}</strong></p>
          <p class="muted">Compras: <strong>{{ purchaseSuccess() }}</strong></p>
          <p class="muted">
            Checkout/Carrito:
            <strong>{{ (beginCheckoutRate() * 100).toFixed(0) }}%</strong>
          </p>
          <p class="muted">
            Compra/Checkout:
            <strong>{{ (purchaseRate() * 100).toFixed(0) }}%</strong>
          </p>
        </article>
        <article class="card">
          <h3>Sin stock / stock bajo</h3>
          <ul class="admin-list">
            @for (product of lowStockProducts(); track product.id) {
              <li class="admin-list__item">
                <div class="admin-list__main">
                  <strong>{{ product.title }}</strong>
                  <span class="muted">stock {{ product.stock }}</span>
                </div>
              </li>
            }
          </ul>
        </article>
        <article class="card">
          <h3>Dispositivos ({{ analyticsDays() }}d)</h3>
          @if (devices().length === 0) {
            <p class="muted">Sin datos aun.</p>
          } @else {
            <ul class="admin-list">
              @for (d of devices(); track d.deviceClass) {
                <li class="admin-list__item">
                  <div class="admin-list__main">
                    <strong>{{ d.deviceClass }}</strong>
                    <span class="muted">
                      {{ d.count }} sesiones ({{ devicePct(d.count) }}%)
                    </span>
                  </div>
                </li>
              }
            </ul>
          }
        </article>
        <article class="card">
          <h3>Evolucion ({{ analyticsDays() }}d)</h3>
          @if (timeseries().length === 0) {
            <p class="muted">Sin datos aun.</p>
          } @else {
            <div class="spark" role="img" aria-label="Vistas vs compras por dia">
              @for (row of timeseries(); track row.day) {
                <div
                  class="spark__col"
                  title="{{ row.day }} | PV: {{ row.pageViews }} | Buy: {{ row.purchaseSuccess }}"
                >
                  <div
                    class="spark__bar spark__bar--pv"
                    [style.height.%]="barPct(row.pageViews, maxPageViews())"
                  ></div>
                  <div
                    class="spark__bar spark__bar--buy"
                    [style.height.%]="barPct(row.purchaseSuccess, maxPurchases())"
                  ></div>
                </div>
              }
            </div>
            <p class="muted">Vistas (izq) vs Compras (der)</p>
          }
        </article>
        <article class="card">
          <h3>Top productos ({{ analyticsDays() }}d)</h3>
          <p class="muted"><strong>Vistas</strong></p>
          <ul class="admin-list">
            @for (p of topProductViews(); track p.productId) {
              <li class="admin-list__item">
                <div class="admin-list__main">
                  <strong>{{ p.title }}</strong>
                  <span class="muted">{{ p.count }}</span>
                </div>
              </li>
            }
          </ul>
          <p class="muted"><strong>Agregados al carrito</strong></p>
          <ul class="admin-list">
            @for (p of topProductAddToCart(); track p.productId) {
              <li class="admin-list__item">
                <div class="admin-list__main">
                  <strong>{{ p.title }}</strong>
                  <span class="muted">{{ p.count }}</span>
                </div>
              </li>
            }
          </ul>
        </article>
        <article class="card">
          <h3>Top eventos ({{ analyticsDays() }}d)</h3>
          <ul class="admin-list">
            @for (row of topEvents(); track row.name) {
              <li class="admin-list__item">
                <div class="admin-list__main">
                  <strong>{{ row.name }}</strong>
                  <span class="muted">{{ row.count }}</span>
                </div>
              </li>
            }
          </ul>
        </article>

        <article class="card">
          <h3>Errores recientes</h3>
          <p class="muted">
            Persistidos (solo 500+). Usa
            <button class="link-button" type="button" (click)="reloadErrors()">recargar</button>.
          </p>
          @if (recentErrors().length === 0) {
            <p class="muted">Sin errores registrados.</p>
          } @else {
            <ul class="admin-list">
              @for (e of recentErrors(); track e.id) {
                <li class="admin-list__item">
                  <div class="admin-list__main">
                    <strong>{{ e.statusCode }}</strong>
                    <span class="muted">{{ e.method }} {{ e.path }}</span>
                    <span class="muted">{{ formatTs(e.timestamp) }}</span>
                  </div>
                  <p class="muted">{{ e.message }}</p>
                </li>
              }
            </ul>
          }
        </article>

        <article class="card">
          <h3>Auditoria reciente</h3>
          <p class="muted">
            Acciones admin/staff. Usa
            <button class="link-button" type="button" (click)="reloadAuditLogs()">recargar</button>.
          </p>
          @if (auditLogs().length === 0) {
            <p class="muted">Sin acciones registradas.</p>
          } @else {
            <ul class="admin-list">
              @for (a of auditLogs(); track a.id) {
                <li class="admin-list__item">
                  <div class="admin-list__main">
                    <strong>{{ a.action }}</strong>
                    <span class="muted">{{ a.entityType }} {{ a.entityId ?? '' }}</span>
                    <span class="muted">{{ a.actorRole ?? 'UNKNOWN' }}</span>
                    <span class="muted">{{ formatTs(a.createdAt) }}</span>
                  </div>
                  @if (a.meta) {
                    <p class="muted">{{ formatMeta(a.meta) }}</p>
                  }
                </li>
              }
            </ul>
          }
        </article>
      </section>
    </section>
  `,
})
export class DashboardPage implements OnInit {
  private readonly api = inject(AdminApiService);

  ordersCount = signal(0);
  revenue = signal(0);
  lowStockProducts = signal<Array<{ id: string; title: string; stock: number }>>([]);

  analyticsDays = signal(7);
  uniqueVisitors = signal(0);
  uniqueSessions = signal(0);
  addToCart = signal(0);
  beginCheckout = signal(0);
  purchaseSuccess = signal(0);
  topEvents = signal<Array<{ name: string; count: number }>>([]);

  devices = signal<Array<{ deviceClass: string; count: number }>>([]);
  timeseries = signal<
    Array<{
      day: string;
      pageViews: number;
      addToCart: number;
      beginCheckout: number;
      purchaseSuccess: number;
    }>
  >([]);
  topProductAddToCart = signal<Array<{ productId: string; title: string; count: number }>>([]);
  topProductViews = signal<Array<{ productId: string; title: string; count: number }>>([]);
  beginCheckoutRate = signal(0);
  purchaseRate = signal(0);

  recentErrors = signal<CachedError[]>([]);
  auditLogs = signal<AuditLog[]>([]);

  maxPageViews = computed(() => Math.max(...this.timeseries().map((r) => r.pageViews), 1));
  maxPurchases = computed(() =>
    Math.max(...this.timeseries().map((r) => r.purchaseSuccess), 1),
  );
  deviceTotal = computed(() => this.devices().reduce((sum, d) => sum + d.count, 0));

  ngOnInit() {
    this.api.dashboard().subscribe((res) => {
      this.ordersCount.set(res.ordersCount);
      this.revenue.set(res.revenue);
      this.lowStockProducts.set(res.lowStockProducts);
    });

    this.loadAnalytics();
    this.reloadErrors();
    this.reloadAuditLogs();
  }

  setAnalyticsDays(days: number) {
    if (days === this.analyticsDays()) {
      return;
    }
    this.analyticsDays.set(days);
    this.loadAnalytics();
  }

  barPct(value: number, max: number) {
    if (max <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  }

  devicePct(count: number) {
    const total = this.deviceTotal();
    if (!total) {
      return 0;
    }
    return Math.round((count / total) * 100);
  }

  private loadAnalytics() {
    this.api.analyticsSummary(this.analyticsDays()).subscribe({
      next: (res) => {
        this.uniqueVisitors.set(res.uniqueVisitors);
        this.uniqueSessions.set(res.uniqueSessions);
        this.addToCart.set(res.funnel.addToCart);
        this.beginCheckout.set(res.funnel.beginCheckout);
        this.purchaseSuccess.set(res.funnel.purchaseSuccess);
        this.topEvents.set(res.byName.slice(0, 8));

        this.beginCheckoutRate.set(res.funnel.rates?.beginCheckoutPerAddToCart ?? 0);
        this.purchaseRate.set(res.funnel.rates?.purchasePerBeginCheckout ?? 0);

        this.devices.set(res.devices ?? []);
        this.timeseries.set(res.timeseries ?? []);
        this.topProductAddToCart.set(res.topProducts?.addToCart ?? []);
        this.topProductViews.set(res.topProducts?.productView ?? []);
      },
      error: () => {
        this.uniqueVisitors.set(0);
        this.uniqueSessions.set(0);
        this.addToCart.set(0);
        this.beginCheckout.set(0);
        this.purchaseSuccess.set(0);
        this.topEvents.set([]);
        this.devices.set([]);
        this.timeseries.set([]);
        this.topProductAddToCart.set([]);
        this.topProductViews.set([]);
        this.beginCheckoutRate.set(0);
        this.purchaseRate.set(0);
      },
    });
  }

  reloadErrors() {
    this.api.recentErrors(10).subscribe({
      next: (res) => this.recentErrors.set(res.items ?? []),
      error: () => this.recentErrors.set([]),
    });
  }

  reloadAuditLogs() {
    this.api.recentAuditLogs(12).subscribe({
      next: (res) => this.auditLogs.set(res.items ?? []),
      error: () => this.auditLogs.set([]),
    });
  }

  formatTs(value: string) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.replace('T', ' ').replace('Z', '').slice(0, 16);
  }

  formatMeta(value: unknown) {
    if (value === undefined || value === null) {
      return '';
    }

    try {
      const raw = JSON.stringify(value);
      if (!raw) {
        return '';
      }
      return raw.length > 180 ? `${raw.slice(0, 180)}...` : raw;
    } catch {
      return '';
    }
  }
}
