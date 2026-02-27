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
          Alta, edicion y baja de catalogo con control de stock, precio, metadata editorial y envio.
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
                <span>Subtitulo</span>
                <input formControlName="subtitle" placeholder="Ej: Edicion coleccionista" />
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
                <span>Genero</span>
                <input formControlName="genre" placeholder="Ej: Ciencia ficcion" />
              </label>

              <label>
                <span>Serie</span>
                <input formControlName="seriesName" placeholder="Ej: Saga Dune" />
              </label>

              <label>
                <span>Nro serie</span>
                <input type="number" formControlName="seriesNumber" placeholder="Ej: 1" />
              </label>

              <label>
                <span>Idioma</span>
                <input formControlName="language" placeholder="Ej: Espanol" />
              </label>

              <label>
                <span>Encuadernacion</span>
                <input formControlName="binding" placeholder="Ej: Tapa Blanda" />
              </label>

              <label>
                <span>Anio edicion</span>
                <input type="number" formControlName="publicationYear" placeholder="Ej: 2026" />
              </label>

              <label>
                <span>Fecha publicacion</span>
                <input type="date" formControlName="publicationDate" />
              </label>

              <label>
                <span>Nro paginas</span>
                <input type="number" formControlName="pageCount" placeholder="Ej: 320" />
              </label>

              <label>
                <span>Edicion</span>
                <input formControlName="edition" placeholder="Ej: 1ra edicion" />
              </label>

              <label>
                <span>Traductor</span>
                <input formControlName="translator" placeholder="Opcional" />
              </label>

              <label>
                <span>Ilustrador</span>
                <input formControlName="illustrator" placeholder="Opcional" />
              </label>

              <label>
                <span>Narrador</span>
                <input formControlName="narrator" placeholder="Solo audiolibro" />
              </label>

              <label>
                <span>Editor</span>
                <input formControlName="editor" placeholder="Responsable editorial" />
              </label>

              <label>
                <span>Pais origen</span>
                <input formControlName="originCountry" placeholder="Ej: Argentina" />
              </label>

              <label>
                <span>Dimensiones (texto)</span>
                <input formControlName="dimensions" placeholder="Ej: 23x15 cm" />
              </label>

              <label>
                <span>Alto (cm)</span>
                <input type="number" formControlName="heightCm" placeholder="Ej: 23.5" />
              </label>

              <label>
                <span>Ancho (cm)</span>
                <input type="number" formControlName="widthCm" placeholder="Ej: 15.0" />
              </label>

              <label>
                <span>Espesor (cm)</span>
                <input type="number" formControlName="thicknessCm" placeholder="Ej: 2.2" />
              </label>

              <label>
                <span>Peso (g)</span>
                <input type="number" formControlName="weightGrams" placeholder="Ej: 420" />
              </label>

              <label>
                <span>Condicion</span>
                <input formControlName="conditionLabel" placeholder="Ej: Nuevo" />
              </label>

              <label>
                <span>ISBN general</span>
                <input formControlName="isbn" placeholder="ISBN (opcional)" />
              </label>

              <label>
                <span>ISBN-10</span>
                <input formControlName="isbn10" placeholder="10 digitos" />
              </label>

              <label>
                <span>ISBN-13</span>
                <input formControlName="isbn13" placeholder="13 digitos" />
              </label>

              <label>
                <span>EAN</span>
                <input formControlName="ean" placeholder="13 digitos" />
              </label>

              <label>
                <span>ETA minima (dias)</span>
                <input type="number" formControlName="shippingEtaMinDays" placeholder="Ej: 2" />
              </label>

              <label>
                <span>ETA maxima (dias)</span>
                <input type="number" formControlName="shippingEtaMaxDays" placeholder="Ej: 5" />
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

              <label>
                <span>Cover URL</span>
                <input formControlName="coverUrl" placeholder="https://..." />
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
                  <span>Subtitulo</span>
                  <input formControlName="subtitle" placeholder="Subtitulo" />
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
                  <span>Genero</span>
                  <input formControlName="genre" placeholder="Genero" />
                </label>

                <label>
                  <span>Serie</span>
                  <input formControlName="seriesName" placeholder="Serie" />
                </label>

                <label>
                  <span>Nro serie</span>
                  <input type="number" formControlName="seriesNumber" placeholder="Ej: 1" />
                </label>

                <label>
                  <span>Idioma</span>
                  <input formControlName="language" placeholder="Idioma" />
                </label>

                <label>
                  <span>Encuadernacion</span>
                  <input formControlName="binding" placeholder="Encuadernacion" />
                </label>

                <label>
                  <span>Anio edicion</span>
                  <input type="number" formControlName="publicationYear" placeholder="Ej: 2026" />
                </label>

                <label>
                  <span>Fecha publicacion</span>
                  <input type="date" formControlName="publicationDate" />
                </label>

                <label>
                  <span>Nro paginas</span>
                  <input type="number" formControlName="pageCount" placeholder="Ej: 320" />
                </label>

                <label>
                  <span>Edicion</span>
                  <input formControlName="edition" placeholder="Edicion" />
                </label>

                <label>
                  <span>Traductor</span>
                  <input formControlName="translator" placeholder="Traductor" />
                </label>

                <label>
                  <span>Ilustrador</span>
                  <input formControlName="illustrator" placeholder="Ilustrador" />
                </label>

                <label>
                  <span>Narrador</span>
                  <input formControlName="narrator" placeholder="Narrador" />
                </label>

                <label>
                  <span>Editor</span>
                  <input formControlName="editor" placeholder="Editor" />
                </label>

                <label>
                  <span>Pais origen</span>
                  <input formControlName="originCountry" placeholder="Pais origen" />
                </label>

                <label>
                  <span>Dimensiones (texto)</span>
                  <input formControlName="dimensions" placeholder="23x15 cm" />
                </label>

                <label>
                  <span>Alto (cm)</span>
                  <input type="number" formControlName="heightCm" placeholder="23.5" />
                </label>

                <label>
                  <span>Ancho (cm)</span>
                  <input type="number" formControlName="widthCm" placeholder="15.0" />
                </label>

                <label>
                  <span>Espesor (cm)</span>
                  <input type="number" formControlName="thicknessCm" placeholder="2.2" />
                </label>

                <label>
                  <span>Peso (g)</span>
                  <input type="number" formControlName="weightGrams" placeholder="420" />
                </label>

                <label>
                  <span>Condicion</span>
                  <input formControlName="conditionLabel" placeholder="Nuevo / Usado" />
                </label>

                <label>
                  <span>ISBN general</span>
                  <input formControlName="isbn" placeholder="ISBN (opcional)" />
                </label>

                <label>
                  <span>ISBN-10</span>
                  <input formControlName="isbn10" placeholder="10 digitos" />
                </label>

                <label>
                  <span>ISBN-13</span>
                  <input formControlName="isbn13" placeholder="13 digitos" />
                </label>

                <label>
                  <span>EAN</span>
                  <input formControlName="ean" placeholder="13 digitos" />
                </label>

                <label>
                  <span>ETA minima (dias)</span>
                  <input type="number" formControlName="shippingEtaMinDays" placeholder="2" />
                </label>

                <label>
                  <span>ETA maxima (dias)</span>
                  <input type="number" formControlName="shippingEtaMaxDays" placeholder="5" />
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
                  @if (p.subtitle) {
                    <span class="muted">{{ p.subtitle }}</span>
                  }
                  <span class="muted">{{ p.type }}</span>
                  @if (p.genre) {
                    <span class="muted">{{ p.genre }}</span>
                  }
                  @if (p.seriesName) {
                    <span class="muted">{{ p.seriesName }}</span>
                  }
                  @if (p.seriesNumber) {
                    <span class="muted">#{{ p.seriesNumber }}</span>
                  }
                  @if (p.language) {
                    <span class="muted">{{ p.language }}</span>
                  }
                  @if (p.publicationYear) {
                    <span class="muted">ed. {{ p.publicationYear }}</span>
                  }
                  @if (p.shippingEtaMinDays || p.shippingEtaMaxDays) {
                    <span class="muted">ETA {{ p.shippingEtaMinDays ?? '?' }}-{{ p.shippingEtaMaxDays ?? '?' }} dias</span>
                  }
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
    subtitle: [''],
    author: ['', Validators.required],
    publisher: [''],
    genre: [''],
    seriesName: [''],
    seriesNumber: [null as number | null],
    language: [''],
    binding: [''],
    publicationYear: [null as number | null],
    publicationDate: [''],
    pageCount: [null as number | null],
    edition: [''],
    translator: [''],
    illustrator: [''],
    narrator: [''],
    editor: [''],
    originCountry: [''],
    dimensions: [''],
    heightCm: [null as number | null],
    widthCm: [null as number | null],
    thicknessCm: [null as number | null],
    weightGrams: [null as number | null],
    conditionLabel: [''],
    isbn: [''],
    isbn10: [''],
    isbn13: [''],
    ean: [''],
    shippingEtaMinDays: [null as number | null],
    shippingEtaMaxDays: [null as number | null],
    description: ['', Validators.required],
    sku: ['', Validators.required],
    type: ['BOOK' as ProductType, Validators.required],
    price: [0, Validators.required],
    stock: [0, Validators.required],
    coverUrl: [''],
    isFeatured: [false],
    isActive: [true],
  });

  editForm = this.fb.group({
    title: ['', Validators.required],
    subtitle: [''],
    author: ['', Validators.required],
    publisher: [''],
    genre: [''],
    seriesName: [''],
    seriesNumber: [null as number | null],
    language: [''],
    binding: [''],
    publicationYear: [null as number | null],
    publicationDate: [''],
    pageCount: [null as number | null],
    edition: [''],
    translator: [''],
    illustrator: [''],
    narrator: [''],
    editor: [''],
    originCountry: [''],
    dimensions: [''],
    heightCm: [null as number | null],
    widthCm: [null as number | null],
    thicknessCm: [null as number | null],
    weightGrams: [null as number | null],
    conditionLabel: [''],
    isbn: [''],
    isbn10: [''],
    isbn13: [''],
    ean: [''],
    shippingEtaMinDays: [null as number | null],
    shippingEtaMaxDays: [null as number | null],
    description: ['', Validators.required],
    sku: ['', Validators.required],
    type: ['BOOK' as ProductType, Validators.required],
    price: [0, Validators.required],
    stock: [0, Validators.required],
    coverUrl: [''],
    isFeatured: [false],
    isActive: [true],
  });

  ngOnInit() {
    this.reload();
  }

  create() {
    const payload = this.form.getRawValue();
    const sanitized = this.sanitizePayload(payload);

    this.api.createProduct(sanitized).subscribe(() => {
      this.form.reset({
        title: '',
        subtitle: '',
        author: '',
        publisher: '',
        genre: '',
        seriesName: '',
        seriesNumber: null,
        language: '',
        binding: '',
        publicationYear: null,
        publicationDate: '',
        pageCount: null,
        edition: '',
        translator: '',
        illustrator: '',
        narrator: '',
        editor: '',
        originCountry: '',
        dimensions: '',
        heightCm: null,
        widthCm: null,
        thicknessCm: null,
        weightGrams: null,
        conditionLabel: '',
        isbn: '',
        isbn10: '',
        isbn13: '',
        ean: '',
        shippingEtaMinDays: null,
        shippingEtaMaxDays: null,
        description: '',
        sku: '',
        type: 'BOOK',
        price: 0,
        stock: 0,
        coverUrl: '',
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
        subtitle: product.subtitle ?? '',
        author: product.author ?? '',
        publisher: product.publisher ?? '',
        genre: product.genre ?? '',
        seriesName: product.seriesName ?? '',
        seriesNumber: product.seriesNumber ?? null,
        language: product.language ?? '',
        binding: product.binding ?? '',
        publicationYear: product.publicationYear ?? null,
        publicationDate: product.publicationDate ? String(product.publicationDate).slice(0, 10) : '',
        pageCount: product.pageCount ?? null,
        edition: product.edition ?? '',
        translator: product.translator ?? '',
        illustrator: product.illustrator ?? '',
        narrator: product.narrator ?? '',
        editor: product.editor ?? '',
        originCountry: product.originCountry ?? '',
        dimensions: product.dimensions ?? '',
        heightCm: this.toNullableNumber(product.heightCm),
        widthCm: this.toNullableNumber(product.widthCm),
        thicknessCm: this.toNullableNumber(product.thicknessCm),
        weightGrams: product.weightGrams ?? null,
        conditionLabel: product.conditionLabel ?? '',
        isbn: product.isbn ?? '',
        isbn10: product.isbn10 ?? '',
        isbn13: product.isbn13 ?? '',
        ean: product.ean ?? '',
        shippingEtaMinDays: product.shippingEtaMinDays ?? null,
        shippingEtaMaxDays: product.shippingEtaMaxDays ?? null,
        description: product.description ?? '',
        sku: product.sku ?? '',
        type: product.type ?? 'BOOK',
        price: this.toNullableNumber(product.price) ?? 0,
        stock: Number(product.stock) || 0,
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

    const payload = this.editForm.getRawValue();
    const sanitized = this.sanitizePayload(payload);

    this.updating.set(true);
    this.editMessage.set('');

    this.api.updateProduct(id, sanitized).subscribe({
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

  private toNullableNumber(input: unknown): number | null {
    if (input === null || input === undefined || input === '') {
      return null;
    }
    const num = Number(input);
    return Number.isFinite(num) ? num : null;
  }

  private sanitizePayload(payload: any) {
    return {
      ...payload,
      title: String(payload.title ?? '').trim(),
      subtitle: payload.subtitle?.trim() || undefined,
      description: String(payload.description ?? '').trim(),
      author: String(payload.author ?? '').trim(),
      publisher: payload.publisher?.trim() || undefined,
      genre: payload.genre?.trim() || undefined,
      seriesName: payload.seriesName?.trim() || undefined,
      seriesNumber:
        payload.seriesNumber === null || payload.seriesNumber === undefined
          ? undefined
          : Number(payload.seriesNumber),
      language: payload.language?.trim() || undefined,
      binding: payload.binding?.trim() || undefined,
      edition: payload.edition?.trim() || undefined,
      translator: payload.translator?.trim() || undefined,
      illustrator: payload.illustrator?.trim() || undefined,
      narrator: payload.narrator?.trim() || undefined,
      editor: payload.editor?.trim() || undefined,
      originCountry: payload.originCountry?.trim() || undefined,
      isbn: payload.isbn?.trim() || undefined,
      isbn10: payload.isbn10?.trim() || undefined,
      isbn13: payload.isbn13?.trim() || undefined,
      ean: payload.ean?.trim() || undefined,
      sku: String(payload.sku ?? '').trim(),
      publicationYear:
        payload.publicationYear === null || payload.publicationYear === undefined
          ? undefined
          : Number(payload.publicationYear),
      publicationDate: payload.publicationDate?.trim() || undefined,
      pageCount:
        payload.pageCount === null || payload.pageCount === undefined
          ? undefined
          : Number(payload.pageCount),
      dimensions: payload.dimensions?.trim() || undefined,
      heightCm:
        payload.heightCm === null || payload.heightCm === undefined
          ? undefined
          : Number(payload.heightCm),
      widthCm:
        payload.widthCm === null || payload.widthCm === undefined
          ? undefined
          : Number(payload.widthCm),
      thicknessCm:
        payload.thicknessCm === null || payload.thicknessCm === undefined
          ? undefined
          : Number(payload.thicknessCm),
      weightGrams:
        payload.weightGrams === null || payload.weightGrams === undefined
          ? undefined
          : Number(payload.weightGrams),
      conditionLabel: payload.conditionLabel?.trim() || undefined,
      shippingEtaMinDays:
        payload.shippingEtaMinDays === null || payload.shippingEtaMinDays === undefined
          ? undefined
          : Number(payload.shippingEtaMinDays),
      shippingEtaMaxDays:
        payload.shippingEtaMaxDays === null || payload.shippingEtaMaxDays === undefined
          ? undefined
          : Number(payload.shippingEtaMaxDays),
      coverUrl: payload.coverUrl?.trim() || undefined,
      type: (payload.type as ProductType) ?? 'BOOK',
      price: Number(payload.price ?? 0),
      stock: Number(payload.stock ?? 0),
      isFeatured: !!payload.isFeatured,
      isActive: payload.isActive !== false,
    };
  }
}
