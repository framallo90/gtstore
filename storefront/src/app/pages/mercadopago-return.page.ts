import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AnalyticsService } from '../core/analytics.service';
import { CartService } from '../core/cart.service';

type ResultKind = 'success' | 'pending' | 'failure';

function asResultKind(value: unknown): ResultKind {
  if (value === 'success' || value === 'pending' || value === 'failure') {
    return value;
  }
  return 'pending';
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-stack">
      <section class="card panel">
        <h2>4) Recibo y estado del pago</h2>
        <p class="muted"><strong>{{ title() }}</strong></p>

        @if (orderId()) {
          <p class="muted">Pedido: <strong>{{ orderId() }}</strong></p>
        }
        @if (paymentId()) {
          <p class="muted">Pago: <strong>{{ paymentId() }}</strong></p>
        }
        @if (status()) {
          <p class="muted">Estado: <strong>{{ status() }}</strong></p>
        }

        <p class="muted">{{ message() }}</p>

        <h3>Emails de estado</h3>
        <ul class="admin-list">
          <li class="admin-list__item">
            <strong>Pedido creado</strong>
            <span class="muted">Se envia cuando se genera la orden.</span>
          </li>
          <li class="admin-list__item">
            <strong>Pago aprobado/rechazado</strong>
            <span class="muted">Se envia luego del webhook de Mercado Pago.</span>
          </li>
          <li class="admin-list__item">
            <strong>Estados logisticos</strong>
            <span class="muted">PROCESSING, SHIPPED y DELIVERED.</span>
          </li>
        </ul>

        <div class="cart__cta">
          <a routerLink="/catalog">Volver al catalogo</a>
          <a routerLink="/profile">Ver mis pedidos</a>
        </div>
      </section>
    </section>
  `,
})
export class MercadoPagoReturnPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly cart = inject(CartService);
  private readonly analytics = inject(AnalyticsService);

  private readonly stateKey = 'gt_checkout_state_v1';

  kind = signal<ResultKind>('pending');
  orderId = signal<string | null>(null);
  paymentId = signal<string | null>(null);
  status = signal<string | null>(null);

  title = signal('Pago pendiente');
  message = signal('Estamos procesando tu pago. Si ya pagaste, en unos segundos deberia verse en tu perfil.');

  ngOnInit() {
    const kind = asResultKind(this.route.snapshot.data['result']);
    this.kind.set(kind);

    const qp = this.route.snapshot.queryParamMap;
    const status = qp.get('status') ?? qp.get('collection_status');
    const paymentId = qp.get('payment_id') ?? qp.get('collection_id');
    const orderId = qp.get('external_reference');

    this.status.set(status);
    this.paymentId.set(paymentId);
    this.orderId.set(orderId);
    this.stripTransientQueryData();

    if (kind === 'success' || status === 'approved') {
      this.title.set('Pago aprobado');
      this.message.set('Gracias. Te enviamos un email y el pedido aparecera como pagado en tu perfil.');
      this.analytics.track('payment_return', { provider: 'mercadopago', result: 'success' });
      this.clearClientState();
      this.cart.clear();
      return;
    }

    if (kind === 'failure' || status === 'rejected') {
      this.title.set('Pago rechazado');
      this.message.set('No se pudo completar el pago. Podes intentarlo nuevamente desde checkout.');
      this.analytics.track('payment_return', { provider: 'mercadopago', result: 'failure' });
      return;
    }

    this.title.set('Pago pendiente');
    this.message.set('Estamos procesando tu pago. Si ya pagaste, en unos segundos deberia verse en tu perfil.');
    this.analytics.track('payment_return', { provider: 'mercadopago', result: 'pending' });
  }

  private clearClientState() {
    try {
      sessionStorage.removeItem(this.stateKey);
    } catch {
      // ignore
    }
  }

  private stripTransientQueryData() {
    if (typeof history === 'undefined' || typeof location === 'undefined') {
      return;
    }

    if (!location.search && !location.hash) {
      return;
    }

    history.replaceState(history.state, '', location.pathname);
  }
}
