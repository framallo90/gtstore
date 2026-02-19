import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../core/admin-api.service';
import { AdminOrder, OrderStatus } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-stack">
      <header class="card page-header panel panel--xl">
        <p class="page-header__eyebrow">Admin</p>
        <h2 class="page-header__title">Gestion de pedidos</h2>
        <p class="page-header__copy">
          Seguimiento de estado y metodo de pago para mantener la operacion ordenada.
        </p>
      </header>

      <section class="card panel panel--xl">
        <ul class="admin-list">
          @for (order of orders(); track order.id) {
            <li class="admin-list__item">
              <div class="admin-list__main">
                <strong>{{ order.id }}</strong>
                <span class="status-chip" [attr.data-status]="order.status">{{ order.status }}</span>
                <span class="muted">{{ order.paymentMethod ?? 'N/A' }}</span>
                <span class="muted">{{ order.total }} USD</span>
              </div>
              <div class="admin-list__actions">
                <select #statusSel [value]="order.status" aria-label="Estado pedido">
                  @for (status of statuses; track status) {
                    <option [value]="status">{{ status }}</option>
                  }
                </select>
                <button type="button" (click)="update(order.id, statusSel.value)">
                  Actualizar
                </button>
              </div>
            </li>
          }
        </ul>
      </section>
    </section>
  `,
})
export class OrdersAdminPage implements OnInit {
  private readonly api = inject(AdminApiService);

  orders = signal<AdminOrder[]>([]);
  statuses: OrderStatus[] = [
    'PENDING',
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELED',
  ];

  ngOnInit() {
    this.reload();
  }

  update(orderId: string, status: string) {
    if (!this.isOrderStatus(status)) {
      return;
    }
    this.api.updateOrderStatus(orderId, status).subscribe(() => this.reload());
  }

  private reload() {
    this.api.listOrders().subscribe((res) => this.orders.set(res));
  }

  private isOrderStatus(value: string): value is OrderStatus {
    return this.statuses.includes(value as OrderStatus);
  }
}
