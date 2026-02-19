import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '../core/admin-api.service';
import { AdminProduct, ProductType } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-stack">
      <header class="card page-header">
        <p class="page-header__eyebrow">Admin</p>
        <h2 class="page-header__title">Productos</h2>
        <p class="page-header__copy">
          Alta, edicion y baja de catalogo con control de stock, precio, editorial y metadata.
        </p>
      </header>

      <section class="grid">
        <article class="card">
          <h3>Crear producto</h3>
          <form class="admin-form" [formGroup]="form" (ngSubmit)="create()">
            <div class="admin-form__grid">
              <label>
                <span>Titulo</span>
                <input formControlName="title" placeholder="Ej: Dune" />
              </label>

              <label>
                <span>Autor</span>
                <input formControlName="author" placeholder="Ej: Frank Herbert" />
              </label>

              <label>
                <span>Editorial</span>
                <input formControlName="publisher" placeholder="Ej: Ace" />
              </label>

              <label>
                <span>SKU</span>
                <input formControlName="sku" placeholder="Ej: BK-0001" />
              </label>

              <label>
                <span>Tipo</span>
                <select formControlName="type">
                  <option value="BOOK">BOOK</option>
                  <option value="COMIC">COMIC</option>
                </select>
              </label>

              <label>
                <span>Precio</span>
                <input type="number" formControlName="price" placeholder="0" />
              </label>

              <label>
                <span>Stock</span>
                <input type="number" formControlName="stock" placeholder="0" />
              </label>
            </div>

            <label>
              <span>Descripcion</span>
              <textarea formControlName="description" placeholder="Descripcion breve"></textarea>
            </label>

            <div class="admin-form__actions">
              <label class="checkbox">
                <input type="checkbox" formControlName="isFeatured" />
                <span>Destacado</span>
              </label>

              <label class="checkbox">
                <input type="checkbox" formControlName="isActive" />
                <span>Activo</span>
              </label>
            </div>

            <div class="admin-form__actions">
              <button [disabled]="form.invalid" type="submit">Crear</button>
            </div>
          </form>
        </article>

        @if (editingId(); as id) {
          <article class="card">
            <h3>Editar producto</h3>
            <p class="muted">ID: {{ id }}</p>

            <form class="admin-form" [formGroup]="editForm" (ngSubmit)="update()">
              <div class="admin-form__grid">
                <label>
                  <span>Titulo</span>
                  <input formControlName="title" placeholder="Titulo" />
                </label>

                <label>
                  <span>Autor</span>
                  <input formControlName="author" placeholder="Autor" />
                </label>

                <label>
                  <span>Editorial</span>
                  <input formControlName="publisher" placeholder="Editorial" />
                </label>

                <label>
                  <span>SKU</span>
                  <input formControlName="sku" placeholder="SKU" />
                </label>

                <label>
                  <span>Tipo</span>
                  <select formControlName="type">
                    <option value="BOOK">BOOK</option>
                    <option value="COMIC">COMIC</option>
                  </select>
                </label>

                <label>
                  <span>Precio</span>
                  <input type="number" formControlName="price" placeholder="Precio" />
                </label>

                <label>
                  <span>Stock</span>
                  <input type="number" formControlName="stock" placeholder="Stock" />
                </label>

                <label>
                  <span>ISBN</span>
                  <input formControlName="isbn" placeholder="ISBN (opcional)" />
                </label>

                <label>
                  <span>Cover URL</span>
                  <input formControlName="coverUrl" placeholder="https://..." />
                </label>
              </div>

              <label>
                <span>Descripcion</span>
                <textarea formControlName="description" placeholder="Descripcion"></textarea>
              </label>

              <div class="admin-form__actions">
                <label class="checkbox">
                  <input type="checkbox" formControlName="isFeatured" />
                  <span>Destacado</span>
                </label>

                <label class="checkbox">
                  <input type="checkbox" formControlName="isActive" />
                  <span>Activo</span>
                </label>
              </div>

              <div class="admin-form__actions">
                <button [disabled]="editForm.invalid || updating()" type="submit">
                  @if (updating()) { Guardando... } @else { Guardar cambios }
                </button>
                <button type="button" (click)="cancelEdit()" [disabled]="updating()">
                  Cancelar
                </button>
              </div>

              @if (editMessage()) {
                <p class="muted">{{ editMessage() }}</p>
              }
            </form>
          </article>
        }

        <article class="card">
          <h3>Listado</h3>
          <ul class="admin-list">
            @for (p of products(); track p.id) {
              <li class="admin-list__item">
                <div class="admin-list__main">
                  <strong>{{ p.title }}</strong>
                  <span class="muted">{{ p.type }}</span>
                  <span class="muted">stock {{ p.stock }}</span>
                  <span class="muted">{{ p.price }} USD</span>
                </div>
                <div class="admin-list__actions">
                  <button type="button" (click)="startEdit(p)">Editar</button>
                  <button type="button" (click)="remove(p.id)">Eliminar</button>
                </div>
              </li>
            }
          </ul>
        </article>
      </section>
    </section>
  `,
})
export class ProductsAdminPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);

  products = signal<AdminProduct[]>([]);
  editingId = signal<string | null>(null);
  updating = signal(false);
  editMessage = signal('');

  form = this.fb.group({
    title: ['', Validators.required],
    author: ['', Validators.required],
    publisher: [''],
    description: ['', Validators.required],
    sku: ['', Validators.required],
    type: ['BOOK' as ProductType, Validators.required],
    price: [0, Validators.required],
    stock: [0, Validators.required],
    isFeatured: [false],
    isActive: [true],
  });

  editForm = this.fb.group({
    title: ['', Validators.required],
    author: ['', Validators.required],
    publisher: [''],
    description: ['', Validators.required],
    sku: ['', Validators.required],
    type: ['BOOK' as ProductType, Validators.required],
    price: [0, Validators.required],
    stock: [0, Validators.required],
    isbn: [''],
    coverUrl: [''],
    isFeatured: [false],
    isActive: [true],
  });

  ngOnInit() {
    this.reload();
  }

  create() {
    const payload = this.form.getRawValue() as {
      title: string;
      description: string;
      author: string;
      publisher?: string;
      sku: string;
      type: ProductType;
      price: number;
      stock: number;
      isFeatured?: boolean;
      isActive?: boolean;
    };

    const sanitized = {
      ...payload,
      publisher: payload.publisher?.trim() || undefined,
    };

    this.api.createProduct(sanitized).subscribe(() => {
      this.form.reset({
        title: '',
        author: '',
        publisher: '',
        description: '',
        sku: '',
        type: 'BOOK',
        price: 0,
        stock: 0,
        isFeatured: false,
        isActive: true,
      });
      this.reload();
    });
  }

  startEdit(product: AdminProduct) {
    this.editingId.set(product.id);
    this.editMessage.set('');
    this.editForm.reset(
      {
        title: product.title ?? '',
        author: product.author ?? '',
        publisher: product.publisher ?? '',
        description: product.description ?? '',
        sku: product.sku ?? '',
        type: product.type ?? 'BOOK',
        price: Number(product.price) || 0,
        stock: Number(product.stock) || 0,
        isbn: product.isbn ?? '',
        coverUrl: product.coverUrl ?? '',
        isFeatured: !!product.isFeatured,
        isActive: !!product.isActive,
      },
      { emitEvent: false },
    );
  }

  cancelEdit() {
    this.editingId.set(null);
    this.editMessage.set('');
    this.updating.set(false);
  }

  update() {
    const id = this.editingId();
    if (!id) {
      return;
    }
    if (this.updating()) {
      return;
    }
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const raw = this.editForm.getRawValue() as {
      title: string;
      author: string;
      publisher?: string;
      description: string;
      sku: string;
      type: ProductType;
      price: number;
      stock: number;
      isbn?: string;
      coverUrl?: string;
      isFeatured?: boolean;
      isActive?: boolean;
    };

    const payload = {
      title: raw.title,
      author: raw.author,
      publisher: raw.publisher?.trim() || undefined,
      description: raw.description,
      sku: raw.sku,
      type: raw.type,
      price: raw.price,
      stock: raw.stock,
      isbn: raw.isbn?.trim() || undefined,
      coverUrl: raw.coverUrl?.trim() || undefined,
      isFeatured: raw.isFeatured ?? false,
      isActive: raw.isActive ?? true,
    };

    this.updating.set(true);
    this.editMessage.set('');

    this.api.updateProduct(id, payload).subscribe({
      next: () => {
        this.editMessage.set('Guardado.');
        this.reload();
      },
      error: () => {
        this.editMessage.set('No se pudo guardar el producto.');
        this.updating.set(false);
      },
      complete: () => {
        this.updating.set(false);
      },
    });
  }

  remove(id: string) {
    this.api.deleteProduct(id).subscribe(() => this.reload());
  }

  private reload() {
    this.api.listProducts().subscribe((res) => this.products.set(res));
  }
}
