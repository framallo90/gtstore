import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AnalyticsService } from '../core/analytics.service';
import { CartService } from '../core/cart.service';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-stack">
      <section class="card panel panel--wide">
        <h2>Carrito</h2>

        @if (!auth.isLoggedIn()) {
          <p class="muted">
            Estas como invitado. Podes comprar sin loguearte. Guardamos tu carrito en este
            dispositivo y lo sincronizamos si mas adelante inicias sesion.
          </p>
          <div class="cart__cta">
            <button type="button" (click)="goCheckout()">Checkout</button>
            <button type="button" (click)="goLogin()">Login</button>
            <button type="button" (click)="goRegister()">Crear cuenta</button>
          </div>
        }

        @if (guestLoading()) {
          <div class="skeleton-list" aria-live="polite" aria-label="Cargando carrito">
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
          </div>
        } @else if (activeLines().length === 0) {
          <p class="muted">Tu carrito esta vacio.</p>
        } @else {
          <ul class="admin-list">
            @for (item of activeLines(); track item.key) {
              <li class="admin-list__item">
                <div class="cart-row__main">
                  <strong>{{ item.product.title }}</strong>
                  <span class="muted">{{ item.product.price }} USD</span>
                </div>

                <div class="cart-row__qty">
                  <button type="button" (click)="dec(item.productId, item.quantity)">-</button>
                  <span class="cart-row__qtyval">{{ item.quantity }}</span>
                  <button
                    type="button"
                    (click)="inc(item.productId, item.quantity, item.product.stock)"
                    [disabled]="item.quantity >= item.product.stock"
                  >
                    +
                  </button>
                  <button type="button" (click)="remove(item.productId)">Quitar</button>
                </div>
              </li>
            }
          </ul>
          <div class="checkout__line checkout__line--total">
            <span class="muted">Total</span>
            <strong>{{ total() }} USD</strong>
          </div>
          <button type="button" (click)="goCheckout()">Ir a checkout</button>
        }
      </section>
    </section>
  `,
})
export class CartPage implements OnInit {
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);

  guestLoading = computed(() => this.cart.guestLoading());
  activeLines = computed(() => this.cart.activeLines());
  total = computed(() => this.cart.activeTotal());

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.cart.refreshServerCart().subscribe();
    } else {
      this.cart.ensureGuestProductsLoaded();
    }

    this.analytics.track('cart_view');
  }

  remove(productId: string) {
    this.cart.remove(productId);
  }

  inc(productId: string, quantity: number, stock: number) {
    if (quantity >= stock) {
      return;
    }
    this.cart.setQuantity(productId, quantity + 1);
  }

  dec(productId: string, quantity: number) {
    this.cart.setQuantity(productId, quantity - 1);
  }

  goCheckout() {
    this.router.navigateByUrl('/checkout');
  }

  goLogin() {
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
  }

  goRegister() {
    this.router.navigate(['/register'], { queryParams: { returnUrl: '/checkout' } });
  }
}
