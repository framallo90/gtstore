import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '../core/admin-api.service';
import { AdminAuthService } from '../core/admin-auth.service';
import { AdminUser, Role } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-stack">
      <header class="card page-header panel panel--xl">
        <p class="page-header__eyebrow">Admin</p>
        <h2 class="page-header__title">Gestion de usuarios</h2>
        <p class="page-header__copy">
          Edita cuentas, permisos y elimina usuarios con confirmacion.
        </p>
      </header>

      <section class="card panel panel--xl">
        @if (error()) {
          <p class="form-alert form-alert--error" role="alert">{{ error() }}</p>
        }

        @if (success()) {
          <p class="form-alert" role="status">{{ success() }}</p>
        }

        @if (loading()) {
          <p class="muted">Cargando usuarios...</p>
        } @else {
          <ul class="admin-list">
            @for (user of users(); track user.id; let i = $index) {
            @if (firstInactiveIndex() === i) {
              <li class="admin-list__item">
                <div class="admin-list__main">
                  <strong>Historial de cuentas desactivadas</strong>
                </div>
                <div class="admin-list__meta">
                  <span class="muted">
                    Las cuentas desactivadas no pueden iniciar sesion ni editarse, pero quedan en historial.
                  </span>
                </div>
              </li>
            }
            <li class="admin-list__item">
              <div class="sr-only" [attr.data-user-anchor]="user.id"></div>
              <div class="admin-list__main">
                <strong>{{ user.email }}</strong>
                <span class="status-chip" [attr.data-status]="user.role">{{ user.role }}</span>
                @if (!isUserActive(user)) {
                  <span class="status-chip" data-status="OFFLINE">DESACTIVADA</span>
                } @else if (isOnline(user)) {
                  <span class="status-chip" data-status="ONLINE">EN LINEA</span>
                } @else {
                  <span class="status-chip" data-status="OFFLINE">DESCONECTADA</span>
                }
              </div>

                <div class="admin-list__meta user-admin-meta">
                  <span>{{ fullName(user) }}</span>
                  <span>Alta: {{ formatDate(user.createdAt) }}</span>
                  <span>Actualizado: {{ formatDate(user.updatedAt) }}</span>
                  <span>Ultima conexion: {{ formatDate(lastConnectionAt(user)) }}</span>
                  <span>{{ daysSinceLastConnectionLabel(user) }}</span>
                  <span>
                    Verificado:
                    {{ user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : 'No' }}
                  </span>
                  @if (!isUserActive(user)) {
                    <span>Desactivada: {{ formatDate(user.deactivatedAt) }}</span>
                  }
              </div>

                <div class="admin-list__actions">
                  <button
                    type="button"
                    (click)="startEdit(user)"
                    [disabled]="!isUserActive(user)"
                    [title]="!isUserActive(user) ? 'La cuenta esta desactivada' : ''"
                  >
                    Editar cuenta
                  </button>
                  @if (isUserActive(user)) {
                    <button
                      type="button"
                      class="button--danger"
                      (click)="deactivateUser(user)"
                      [disabled]="deletingId() === user.id || isCurrentUser(user)"
                      [title]="deleteTitle(user)"
                    >
                      @if (deletingId() === user.id) {
                        Desactivando...
                      } @else {
                        Desactivar cuenta
                      }
                    </button>
                  } @else {
                    <button
                      type="button"
                      (click)="reactivateUser(user)"
                      [disabled]="reactivatingId() === user.id"
                    >
                      @if (reactivatingId() === user.id) {
                        Reactivando...
                      } @else {
                        Reactivar cuenta
                      }
                    </button>
                  }
                  @if (isCurrentUser(user)) {
                    <span class="muted">Tu cuenta no se puede desactivar desde este panel.</span>
                  } @else if (!isUserActive(user)) {
                    <span class="muted">Cuenta historica (solo lectura). Reactivala para editar.</span>
                  }
                </div>

                @if (editingId() === user.id && isUserActive(user)) {
                  <form class="admin-form user-edit-form" [formGroup]="editForm" (ngSubmit)="saveEdit()">
                    <div class="admin-form__grid">
                      <label>
                        <span>Email o usuario</span>
                        <input formControlName="email" maxlength="200" autocomplete="username" />
                      </label>
                      <label>
                        <span>Rol</span>
                        <select formControlName="role">
                          @for (role of roles; track role) {
                            <option [value]="role">{{ role }}</option>
                          }
                        </select>
                      </label>
                    </div>

                    <div class="admin-form__grid">
                      <label>
                        <span>Nombre</span>
                        <input formControlName="firstName" maxlength="80" />
                      </label>
                      <label>
                        <span>Apellido</span>
                        <input formControlName="lastName" maxlength="80" />
                      </label>
                    </div>

                    <label>
                      <span>Nueva password (opcional)</span>
                      <input
                        formControlName="password"
                        type="password"
                        minlength="8"
                        maxlength="200"
                        autocomplete="new-password"
                        placeholder="Dejar vacio para mantener la actual"
                      />
                    </label>

                    <div class="admin-form__actions">
                      <button
                        type="submit"
                        [disabled]="editForm.invalid || savingId() === user.id"
                      >
                        {{ savingId() === user.id ? 'Guardando...' : 'Guardar cambios' }}
                      </button>
                      <button
                        type="button"
                        (click)="cancelEdit()"
                        [disabled]="savingId() === user.id"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                }
              </li>
            }
          </ul>
        }
      </section>
    </section>
  `,
})
export class UsersAdminPage implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AdminAuthService);
  private readonly fb = inject(FormBuilder);

  users = signal<AdminUser[]>([]);
  firstInactiveIndex = computed(() => this.users().findIndex((user) => !this.isUserActive(user)));
  loading = signal(false);
  error = signal('');
  success = signal('');
  editingId = signal<string | null>(null);
  savingId = signal<string | null>(null);
  deletingId = signal<string | null>(null);
  reactivatingId = signal<string | null>(null);

  roles: Role[] = ['CUSTOMER', 'STAFF', 'ADMIN'];

  editForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.maxLength(200)]],
    firstName: ['', [Validators.maxLength(80)]],
    lastName: ['', [Validators.maxLength(80)]],
    role: ['CUSTOMER' as Role, [Validators.required]],
    password: ['', [Validators.minLength(8), Validators.maxLength(200)]],
  });

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.api.listUsers().subscribe({
      next: (res) => this.users.set(this.sortUsers(res)),
      error: (err) => this.error.set(this.formatError(err)),
      complete: () => this.loading.set(false),
    });
  }

  startEdit(user: AdminUser) {
    if (!this.isUserActive(user)) {
      this.error.set('La cuenta esta desactivada. Solo se muestra en historial.');
      return;
    }
    this.error.set('');
    this.success.set(`Editando cuenta ${user.email}`);
    this.editingId.set(user.id);
    this.editForm.setValue({
      email: user.email ?? '',
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      role: user.role,
      password: '',
    });

    setTimeout(() => this.scrollToUserRow(user.id), 0);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.savingId.set(null);
    this.editForm.reset({
      email: '',
      firstName: '',
      lastName: '',
      role: 'CUSTOMER',
      password: '',
    });
  }

  saveEdit() {
    const userId = this.editingId();
    if (!userId) {
      return;
    }

    const user = this.users().find((item) => item.id === userId);
    if (!user || !this.isUserActive(user)) {
      this.error.set('La cuenta ya no esta activa y no puede editarse.');
      this.cancelEdit();
      return;
    }

    if (this.editForm.invalid || this.savingId()) {
      this.editForm.markAllAsTouched();
      return;
    }

    const email = this.editForm.controls.email.value.trim().toLowerCase();
    const firstName = this.editForm.controls.firstName.value.trim();
    const lastName = this.editForm.controls.lastName.value.trim();
    const role = this.editForm.controls.role.value;
    const password = this.editForm.controls.password.value.trim();

    if (!email) {
      this.error.set('Email o usuario es obligatorio.');
      return;
    }

    this.savingId.set(userId);
    this.error.set('');
    this.success.set('');

    const payload: {
      email: string;
      role: Role;
      firstName?: string;
      lastName?: string;
      password?: string;
    } = {
      email,
      role,
    };

    if (firstName.length > 0) {
      payload.firstName = firstName;
    }
    if (lastName.length > 0) {
      payload.lastName = lastName;
    }

    if (password.length > 0) {
      payload.password = password;
    }

    this.api.updateUser(userId, payload).subscribe({
      next: (updated) => {
        this.users.update((items) =>
          this.sortUsers(items.map((item) => (item.id === userId ? updated : item))),
        );
        this.success.set(`Usuario ${updated.email} actualizado.`);
        this.cancelEdit();
      },
      error: (err) => {
        this.error.set(this.formatError(err));
        this.savingId.set(null);
      },
      complete: () => {
        this.savingId.set(null);
      },
    });
  }

  deactivateUser(user: AdminUser) {
    if (this.isCurrentUser(user)) {
      this.error.set('No puedes desactivar tu propia cuenta.');
      return;
    }

    if (!this.isUserActive(user)) {
      this.error.set('La cuenta ya esta desactivada y se mantiene en historial.');
      return;
    }

    if (this.deletingId()) {
      return;
    }

    if (!this.confirmDeactivation(user)) {
      return;
    }

    this.editingId.set(null);
    this.executeDelete(user);
  }

  executeDelete(user: AdminUser) {
    if (this.deletingId()) {
      return;
    }

    this.deletingId.set(user.id);
    this.error.set('');
    this.success.set('');

    this.api.deleteUser(user.id).subscribe({
      next: (res) => {
        this.users.update((items) =>
          this.sortUsers(items.map((item) => (item.id === user.id ? res.deactivatedUser : item))),
        );
        if (this.editingId() === user.id) {
          this.cancelEdit();
        }
        this.success.set(`Cuenta ${user.email} desactivada y movida a historial.`);
      },
      error: (err) => {
        this.error.set(this.formatError(err));
      },
      complete: () => {
        this.deletingId.set(null);
      },
    });
  }

  reactivateUser(user: AdminUser) {
    if (this.reactivatingId()) {
      return;
    }

    if (this.isUserActive(user)) {
      this.success.set(`La cuenta ${user.email} ya esta activa.`);
      return;
    }

    this.reactivatingId.set(user.id);
    this.error.set('');
    this.success.set('');

    this.api.reactivateUser(user.id).subscribe({
      next: (res) => {
        this.users.update((items) =>
          this.sortUsers(items.map((item) => (item.id === user.id ? res.reactivatedUser : item))),
        );
        this.success.set(`Cuenta ${user.email} reactivada. Ya puedes editarla.`);
      },
      error: (err) => {
        this.error.set(this.formatError(err));
      },
      complete: () => {
        this.reactivatingId.set(null);
      },
    });
  }

  isCurrentUser(user: AdminUser) {
    return this.auth.getUserId() === user.id;
  }

  isUserActive(user: AdminUser) {
    return user.isActive !== false;
  }

  deleteTitle(user: AdminUser) {
    if (this.isCurrentUser(user)) {
      return 'No puedes desactivar tu propia cuenta';
    }
    if (!this.isUserActive(user)) {
      return 'La cuenta ya esta desactivada';
    }
    return '';
  }

  lastConnectionAt(user: AdminUser) {
    return user.lastSeenAt ?? user.lastLoginAt ?? null;
  }

  isOnline(user: AdminUser) {
    if (!this.isUserActive(user)) {
      return false;
    }
    const value = this.lastConnectionAt(user);
    if (!value) {
      return false;
    }
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) {
      return false;
    }
    return Date.now() - timestamp <= 5 * 60 * 1000;
  }

  daysSinceLastConnectionLabel(user: AdminUser) {
    const value = this.lastConnectionAt(user);
    if (!value) {
      return 'Sin actividad registrada';
    }
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) {
      return 'Sin actividad registrada';
    }
    const diffMs = Math.max(0, Date.now() - timestamp);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 0) {
      return 'Actividad hoy';
    }
    if (days === 1) {
      return 'Ultima conexion hace 1 dia';
    }
    return `Ultima conexion hace ${days} dias`;
  }

  fullName(user: AdminUser) {
    const value = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return value || '-';
  }

  formatDate(value?: string | null) {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  private formatError(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return 'No pudimos completar la operacion. Intenta de nuevo.';
    }

    const serverMessage = this.extractApiMessage(err);
    if (serverMessage) {
      return serverMessage;
    }

    if (err.status === 0) {
      return 'No pudimos conectar con el servidor. Revisa la conexion.';
    }

    if (err.status === 400) {
      return 'No se pudo aplicar el cambio. Revisa los datos e intenta de nuevo.';
    }

    if (err.status === 401 || err.status === 403) {
      return 'No tienes permisos para gestionar usuarios.';
    }

    if (err.status === 404) {
      return 'El usuario ya no existe o fue modificado.';
    }

    if (err.status === 409) {
      return 'Ese email ya esta en uso por otra cuenta.';
    }

    return 'No pudimos completar la operacion. Intenta de nuevo.';
  }

  private extractApiMessage(err: HttpErrorResponse): string | null {
    const payload = err.error;
    if (!payload) {
      return null;
    }

    if (typeof payload === 'string' && payload.trim().length > 0) {
      return payload.trim();
    }

    if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
      return payload.message.trim();
    }

    if (Array.isArray(payload.message) && payload.message.length > 0) {
      const first = payload.message.find(
        (item: unknown) => typeof item === 'string' && item.trim().length > 0,
      );
      if (first) {
        return first.trim();
      }
    }

    return null;
  }

  private confirmDeactivation(user: AdminUser) {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
      return true;
    }
    return window.confirm(
      `Vas a desactivar la cuenta ${user.email}. No podra iniciar sesion ni editarse desde el panel. Deseas continuar?`,
    );
  }

  private scrollToUserRow(userId: string) {
    if (typeof document === 'undefined') {
      return;
    }

    const safeId = userId.replace(/'/g, "\\'");
    const row = document.querySelector(`[data-user-anchor='${safeId}']`)?.closest('li');
    if (row instanceof HTMLElement) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  private sortUsers(items: AdminUser[]) {
    return [...items].sort((a, b) => {
      const activeA = this.isUserActive(a) ? 1 : 0;
      const activeB = this.isUserActive(b) ? 1 : 0;
      if (activeA !== activeB) {
        return activeB - activeA;
      }

      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }
}
