import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../core/admin-api.service';
import { AdminUser, Role } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-stack">
      <header class="card page-header panel panel--xl">
        <p class="page-header__eyebrow">Admin</p>
        <h2 class="page-header__title">Gestion de usuarios</h2>
        <p class="page-header__copy">
          Controla permisos CUSTOMER / STAFF / ADMIN con cambios rapidos y trazables.
        </p>
      </header>

      <section class="card panel panel--xl">
        <ul class="admin-list">
          @for (user of users(); track user.id) {
            <li class="admin-list__item">
              <div class="admin-list__main">
                <strong>{{ user.email }}</strong>
                <span class="status-chip" [attr.data-status]="user.role">{{ user.role }}</span>
              </div>
              <div class="admin-list__actions">
                <select #roleSel [value]="user.role" aria-label="Rol de usuario">
                  @for (role of roles; track role) {
                    <option [value]="role">{{ role }}</option>
                  }
                </select>
                <button type="button" (click)="updateRole(user.id, roleSel.value)">
                  Cambiar rol
                </button>
              </div>
            </li>
          }
        </ul>
      </section>
    </section>
  `,
})
export class UsersAdminPage implements OnInit {
  private readonly api = inject(AdminApiService);

  users = signal<AdminUser[]>([]);
  roles: Role[] = ['CUSTOMER', 'STAFF', 'ADMIN'];

  ngOnInit() {
    this.reload();
  }

  updateRole(userId: string, role: string) {
    if (!this.isRole(role)) {
      return;
    }
    this.api.updateUserRole(userId, role).subscribe(() => this.reload());
  }

  private reload() {
    this.api.listUsers().subscribe((res) => this.users.set(res));
  }

  private isRole(value: string): value is Role {
    return this.roles.includes(value as Role);
  }
}
