import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AnalyticsService } from '../core/analytics.service';
import { CartService } from '../core/cart.service';
import { Product } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-stack">
      @if (product(); as p) {
        <section class="card panel panel--wide">
          <h2>{{ p.title }}</h2>
          <p class="muted">{{ p.author }} - {{ p.type }}</p>
          <p class="muted">{{ p.description }}</p>
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
          </div>
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
  private readonly cart = inject(CartService);
  private readonly analytics = inject(AnalyticsService);

  product = signal<Product | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api.getProductById(id).subscribe((res) => {
        this.product.set(res);
        this.analytics.track('product_view', { productId: res.id, type: res.type });
      });
    }
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
}
