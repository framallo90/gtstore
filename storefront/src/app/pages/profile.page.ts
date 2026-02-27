import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { Order, UserProfile, WishlistItem } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-stack">
      <header class="card page-header panel">
        <p class="page-header__eyebrow">Cuenta</p>
        <h2 class="page-header__title">Perfil</h2>
        <p class="page-header__copy">
          Datos personales y trazabilidad de pedidos en un solo lugar.
        </p>
      </header>

      <section class="card panel">
        @if (profile(); as p) {
          <div class="admin-list">
            <div class="admin-list__item">
              <div class="admin-list__main">
                <strong>Nombre</strong>
                <span class="muted">{{ p.firstName }} {{ p.lastName }}</span>
              </div>
            </div>
            <div class="admin-list__item">
              <div class="admin-list__main">
                <strong>Email</strong>
                <span class="muted">{{ p.email }}</span>
              </div>
            </div>
            <div class="admin-list__item">
              <div class="admin-list__main">
                <strong>Rol</strong>
                <span class="status-chip" [attr.data-status]="p.role">{{ p.role }}</span>
              </div>
            </div>
          </div>
        } @else {
          <p class="muted">Cargando perfil...</p>
        }
      </section>

      <section class="card panel panel--wide">
        <h3>Mis pedidos</h3>
        @if (orders().length === 0) {
          <p class="muted">Sin pedidos aun.</p>
        } @else {
          <ul class="admin-list">
            @for (order of orders(); track order.id) {
              <li class="admin-list__item">
                <div class="admin-list__main">
                  <strong>{{ order.id }}</strong>
                  <span class="status-chip" [attr.data-status]="order.status">{{ order.status }}</span>
                  <span class="muted">{{ order.total }} USD</span>
                </div>
              </li>
            }
          </ul>
        }
      </section>

      <section class="card panel panel--wide">
        <h3>Mis favoritos</h3>
        @if (wishlist().length === 0) {
          <p class="muted">Todavia no guardaste productos.</p>
        } @else {
          <ul class="admin-list">
            @for (item of wishlist(); track item.id) {
              <li class="admin-list__item">
                <div class="admin-list__main">
                  <strong>{{ item.product.title }}</strong>
                  <span class="muted">{{ item.product.price }} USD</span>
                  <span class="muted">Guardado: {{ item.createdAt | date: 'yyyy-MM-dd' }}</span>
                </div>
                <div class="admin-list__actions">
                  <a [routerLink]="['/products', item.productId]">Ver detalle</a>
                </div>
              </li>
            }
          </ul>
        }
      </section>
    </section>
  `,
})
export class ProfilePage implements OnInit {
  private readonly api = inject(ApiService);

  profile = signal<UserProfile | null>(null);
  orders = signal<Order[]>([]);
  wishlist = signal<WishlistItem[]>([]);

  ngOnInit() {
    this.api.me().subscribe((res) => this.profile.set(res));
    this.api.myOrders().subscribe((res) => this.orders.set(res));
    this.api.getWishlist().subscribe((res) => this.wishlist.set(res));
  }
}
