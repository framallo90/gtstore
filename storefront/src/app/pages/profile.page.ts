import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../core/api.service';
import { Order, UserProfile } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule],
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
    </section>
  `,
})
export class ProfilePage implements OnInit {
  private readonly api = inject(ApiService);

  profile = signal<UserProfile | null>(null);
  orders = signal<Order[]>([]);

  ngOnInit() {
    this.api.me().subscribe((res) => this.profile.set(res));
    this.api.myOrders().subscribe((res) => this.orders.set(res));
  }
}
