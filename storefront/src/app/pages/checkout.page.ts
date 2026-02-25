import {
  Component,
  DestroyRef,
  Injector,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { AnalyticsService } from '../core/analytics.service';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import type { Order, OrderQuote, PaymentMethod } from '../core/models';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-stack">
      <section class="card panel panel--wide">
        <h2>Checkout</h2>

        @if (guestLoading()) {
          <div class="skeleton-list" aria-live="polite" aria-label="Cargando carrito">
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
            <div class="skeleton-row"></div>
          </div>
        } @else if (activeLines().length === 0 && !completedOrder()) {
          <p class="muted">No hay items en el carrito.</p>
        } @else {
          <ol class="checkout-stepper" aria-label="Etapas de compra">
            @for (step of checkoutSteps; track step.id) {
              <li
                class="checkout-stepper__item"
                [class.checkout-stepper__item--active]="currentStep() === step.id"
                [class.checkout-stepper__item--done]="
                  currentStep() > step.id || (step.id === 4 && !!completedOrder())
                "
              >
                <button
                  class="checkout-stepper__dot"
                  type="button"
                  [disabled]="!canJumpToStep(step.id)"
                  (click)="goToStep(step.id)"
                >
                  {{ step.id }}
                </button>
                <div class="checkout-stepper__copy">
                  <strong>{{ step.title }}</strong>
                  <p class="muted">{{ step.caption }}</p>
                </div>
              </li>
            }
          </ol>

          <form [formGroup]="form" (ngSubmit)="submit()">
            @if (currentStep() === 1) {
              <section class="checkout-stage">
                <h3>1) Resumen de compra</h3>
                <ul class="admin-list">
                  @for (item of activeLines(); track item.key) {
                    <li class="admin-list__item checkout-item">
                      <div class="checkout-item__thumb" aria-hidden="true">
                        @if (item.product.coverUrl) {
                          <img [src]="item.product.coverUrl" [alt]="'Portada de ' + item.product.title" loading="lazy" />
                        } @else {
                          <div class="checkout-item__thumb--placeholder"></div>
                        }
                      </div>
                      <div class="cart-row__main">
                        <strong>{{ item.product.title }}</strong>
                        <span class="muted">x{{ item.quantity }}</span>
                      </div>
                      <span class="muted">{{ item.product.price * item.quantity }} USD</span>
                    </li>
                  }
                </ul>

                <label for="couponCode">Cupon</label>
                <div class="checkout__coupon">
                  <input
                    id="couponCode"
                    formControlName="couponCode"
                    placeholder="Ej: GEEK10"
                    autocomplete="off"
                  />
                  <button type="button" (click)="applyCoupon()" [disabled]="quoteLoading()">
                    Aplicar
                  </button>
                </div>

                <div class="checkout__totals">
                  <div class="checkout__line">
                    <span class="muted">Subtotal</span>
                    <strong>{{ displaySubtotal() }} USD</strong>
                  </div>
                  @if (displayDiscount() > 0) {
                    <div class="checkout__line">
                      <span class="muted">Descuento</span>
                      <strong>-{{ displayDiscount() }} USD</strong>
                    </div>
                  }
                  @if (displayShippingCost() > 0) {
                    <div class="checkout__line">
                      <span class="muted">
                        Envio {{ displayShippingProvider() ? '(' + displayShippingProvider() + ')' : '' }}
                      </span>
                      <strong>{{ displayShippingCost() }} USD</strong>
                    </div>
                  }
                  <div class="checkout__line checkout__line--total">
                    <span class="muted">Total parcial</span>
                    <strong>{{ displayTotal() }} USD</strong>
                  </div>
                  @if (quoteLoading()) {
                    <p class="loading-inline"><span class="spinner" aria-hidden="true"></span>Calculando total...</p>
                  }
                  @if (quoteError()) {
                    <p class="muted">{{ quoteError() }}</p>
                  }
                </div>

                <div class="checkout-actions">
                  <button type="button" (click)="goToStep(2)">Continuar a envio</button>
                </div>
              </section>
            }

            @if (currentStep() === 2) {
              <section class="checkout-stage">
                <h3>2) Envio</h3>
                <p class="muted">
                  Completa ciudad y codigo postal para cotizar con Andreani.
                </p>

                <label for="shippingCity">Ciudad</label>
                <input
                  id="shippingCity"
                  formControlName="shippingCity"
                  placeholder="Ej: Rosario"
                  autocomplete="address-level2"
                />

                <label for="shippingPostalCode">Codigo postal</label>
                <input
                  id="shippingPostalCode"
                  formControlName="shippingPostalCode"
                  placeholder="Ej: 2000"
                  autocomplete="postal-code"
                  inputmode="numeric"
                  [attr.aria-invalid]="shippingPostalCodeInvalid()"
                  [attr.aria-errormessage]="shippingPostalCodeInvalid() ? 'checkout-shipping-postal-error' : null"
                />
                @if (shippingPostalCodeInvalid()) {
                  <p id="checkout-shipping-postal-error" class="field-msg field-msg--error">
                    Codigo postal invalido. Usa 4-8 digitos o formato CPA.
                  </p>
                }
                @if (postalLookupLoading()) {
                  <p class="field-msg field-msg--hint">Buscando ciudad sugerida por CP...</p>
                } @else if (postalLookupMessage()) {
                  <p class="field-msg field-msg--hint">{{ postalLookupMessage() }}</p>
                }

                @if (shippingMapUrl(); as mapUrl) {
                  <div class="shipping-map">
                    <iframe
                      [src]="mapUrl"
                      title="Mapa de envio"
                      loading="lazy"
                      referrerpolicy="no-referrer-when-downgrade"
                    ></iframe>
                  </div>
                } @else {
                  <p class="field-msg field-msg--hint">
                    Ingresa ciudad y CP para ver el mapa de destino.
                  </p>
                }

                <div class="checkout__totals">
                  <div class="checkout__line">
                    <span class="muted">Subtotal productos</span>
                    <strong>{{ displaySubtotal() }} USD</strong>
                  </div>
                  <div class="checkout__line">
                    <span class="muted">
                      Costo de envio
                      {{ displayShippingProvider() ? '(' + displayShippingProvider() + ')' : '' }}
                    </span>
                    <strong>
                      @if (displayShippingCost() > 0) {
                        {{ displayShippingCost() }} USD
                      } @else {
                        A cotizar
                      }
                    </strong>
                  </div>
                  <div class="checkout__line checkout__line--total">
                    <span class="muted">Total estimado</span>
                    <strong>{{ displayTotal() }} USD</strong>
                  </div>
                  @if (quoteLoading()) {
                    <p class="loading-inline"><span class="spinner" aria-hidden="true"></span>Cotizando envio...</p>
                  }
                  @if (quoteError()) {
                    <p class="field-msg field-msg--error">{{ quoteError() }}</p>
                  }
                </div>

                <div class="checkout-actions">
                  <button type="button" class="link-button" (click)="goToStep(1)">Volver</button>
                  <button type="button" (click)="refreshShippingQuote()" [disabled]="quoteLoading()">
                    Recalcular envio
                  </button>
                  <button type="button" (click)="goToStep(3)">Continuar a pago</button>
                </div>
              </section>
            }

            @if (currentStep() === 3) {
              <section class="checkout-stage">
                <h3>3) Pago</h3>

                <p class="field-msg field-msg--hint">Elegi como queres pagar.</p>
                <div class="payment-cards" role="radiogroup" aria-label="Metodo de pago" aria-describedby="paymentMethodHint">
                  @for (option of paymentOptions; track option.value) {
                    <label class="payment-card" [class.payment-card--selected]="form.controls.paymentMethod.value === option.value">
                      <input class="sr-only" type="radio" formControlName="paymentMethod" [value]="option.value" />
                      <span class="payment-card__icon" aria-hidden="true">{{ option.icon }}</span>
                      <span class="payment-card__copy">
                        <strong>{{ option.label }}</strong>
                        <small>{{ option.description }}</small>
                      </span>
                    </label>
                  }
                </div>
                <p id="paymentMethodHint" class="field-msg field-msg--hint">
                  @if (form.get('paymentMethod')?.value === 'MERCADOPAGO') {
                    Te redirigimos a Mercado Pago para completar el pago.
                  } @else {
                    El pedido queda en estado PENDIENTE hasta confirmar acreditacion.
                  }
                </p>

                @if (!auth.isLoggedIn()) {
                  <h3>Datos del comprador</h3>
                  <p class="muted">
                    Podes comprar como invitado y guardar tus datos en este dispositivo.
                  </p>

                  <label for="guestEmail">Email</label>
                  <input
                    id="guestEmail"
                    formControlName="guestEmail"
                    type="email"
                    autocomplete="email"
                    inputmode="email"
                    [attr.aria-invalid]="guestEmailInvalid()"
                    [attr.aria-errormessage]="guestEmailInvalid() ? 'checkout-guest-email-error' : null"
                  />
                  @if (guestEmailInvalid()) {
                    <p id="checkout-guest-email-error" class="field-msg field-msg--error">{{ guestEmailErrorMessage() }}</p>
                  } @else {
                    <p class="field-msg field-msg--hint">
                      A este email te enviamos confirmaciones y links de pago.
                    </p>
                  }

                  <label for="guestFirstName">Nombre</label>
                  <input id="guestFirstName" formControlName="guestFirstName" autocomplete="given-name" />

                  <label for="guestLastName">Apellido</label>
                  <input id="guestLastName" formControlName="guestLastName" autocomplete="family-name" />

                  <label class="checkbox">
                    <input type="checkbox" formControlName="rememberGuest" />
                    Guardar estos datos solo en este dispositivo para retomar el checkout.
                  </label>

                  <div class="cart__cta">
                    <button type="button" (click)="goLogin()">Login</button>
                    <button type="button" (click)="goRegister()">Crear cuenta</button>
                  </div>
                }

                <label for="notes">Notas</label>
                <textarea id="notes" formControlName="notes"></textarea>

                <div class="checkout__totals">
                  <div class="checkout__line">
                    <span class="muted">Total a pagar</span>
                    <strong>{{ displayTotal() }} USD</strong>
                  </div>
                </div>

                <div class="checkout-actions">
                  <button type="button" class="link-button" (click)="goToStep(2)">Volver</button>
                  <button [disabled]="submitting()" type="submit">
                    @if (auth.isLoggedIn()) { Confirmar pedido } @else { Comprar como invitado }
                  </button>
                </div>

                <ul class="checkout-trust" aria-label="Compra segura">
                  <li class="checkout-trust__item">
                    <span class="checkout-trust__icon" aria-hidden="true">SSL</span>
                    <span>Sitio seguro cifrado</span>
                  </li>
                  <li class="checkout-trust__item">
                    <span class="checkout-trust__icon" aria-hidden="true">PCI</span>
                    <span>Pagos procesados de forma segura</span>
                  </li>
                  <li class="checkout-trust__item">
                    <span class="checkout-trust__icon" aria-hidden="true">MP</span>
                    <span>Checkout protegido por Mercado Pago</span>
                  </li>
                </ul>
              </section>
            }

            @if (currentStep() === 4) {
              <section class="checkout-stage">
                <h3>4) Recibo y estados</h3>

                @if (completedOrder(); as order) {
                  <div class="checkout__totals">
                    <div class="checkout__line">
                      <span class="muted">Pedido</span>
                      <strong>{{ order.id }}</strong>
                    </div>
                    <div class="checkout__line">
                      <span class="muted">Metodo</span>
                      <strong>{{ order.paymentMethod || 'No informado' }}</strong>
                    </div>
                    <div class="checkout__line">
                      <span class="muted">Total final</span>
                      <strong>{{ order.total }} USD</strong>
                    </div>
                    @if (order.shippingCost) {
                      <div class="checkout__line">
                        <span class="muted">Envio</span>
                        <strong>{{ order.shippingCost }} USD</strong>
                      </div>
                    }
                  </div>
                } @else {
                  <p class="muted">No hay recibo cargado todavia.</p>
                }

                <h3>Emails de estado</h3>
                <ul class="admin-list">
                  <li class="admin-list__item">
                    <strong>1. Confirmacion inicial</strong>
                    <span class="muted">Te llega al crear el pedido (PENDIENTE).</span>
                  </li>
                  <li class="admin-list__item">
                    <strong>2. Actualizacion de pago</strong>
                    <span class="muted">
                      Si pagas por Mercado Pago, recibis confirmacion cuando el webhook lo aprueba.
                    </span>
                  </li>
                  <li class="admin-list__item">
                    <strong>3. Cambios logisticos</strong>
                    <span class="muted">
                      Cuando el pedido pase a PROCESSING, SHIPPED y DELIVERED.
                    </span>
                  </li>
                </ul>

                <div class="checkout-actions">
                  <button type="button" (click)="goCatalog()">Seguir comprando</button>
                  <button type="button" (click)="goProfile()">Ver mis pedidos</button>
                </div>
              </section>
            }
          </form>

          @if (message()) {
            <p id="checkout-message" class="form-alert" role="status" aria-live="polite" tabindex="-1">{{ message() }}</p>
          }
        }
      </section>
    </section>
  `,
  styles: `
    .checkout-item {
      display: grid;
      grid-template-columns: 54px 1fr auto;
      align-items: center;
      gap: 0.7rem;
    }

    .checkout-item__thumb {
      width: 54px;
      height: 72px;
      border-radius: 10px;
      border: 1px solid hsl(var(--brand-h) 34% 74% / 0.72);
      background: hsl(0 0% 100% / 0.86);
      overflow: hidden;
    }

    .checkout-item__thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .checkout-item__thumb--placeholder {
      width: 100%;
      height: 100%;
      background:
        radial-gradient(
          320px 160px at 15% -20%,
          hsl(var(--h1) 90% 60% / 0.24),
          transparent 55%
        ),
        linear-gradient(140deg, hsl(var(--brand-h) 35% 92%), hsl(var(--brand-h) 20% 98%));
    }

    .payment-cards {
      display: grid;
      gap: 0.55rem;
    }

    .payment-card {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 0.6rem;
      padding: 0.68rem 0.82rem;
      border-radius: var(--radius-sm);
      border: 1px solid hsl(var(--brand-h) 34% 74% / 0.72);
      background: hsl(0 0% 100% / 0.8);
      cursor: pointer;
      transition:
        border-color 140ms ease,
        box-shadow 140ms ease,
        transform 140ms ease,
        background 140ms ease;
    }

    .payment-card:hover {
      transform: translateY(-1px);
      border-color: hsl(var(--brand-h) 46% 62% / 0.74);
      box-shadow: var(--shadow-sm);
    }

    .payment-card--selected {
      border-color: hsl(var(--h2) 64% 46% / 0.52);
      background: linear-gradient(145deg, hsl(0 0% 100% / 0.92), hsl(var(--h2) 82% 94% / 0.88));
      box-shadow: var(--shadow-sm);
    }

    .payment-card__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 999px;
      border: 1px solid hsl(var(--brand-h) 34% 74% / 0.72);
      background: hsl(var(--brand-h) 44% 96% / 0.9);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .payment-card__copy {
      display: grid;
      gap: 0.08rem;
    }

    .payment-card__copy small {
      color: var(--muted);
    }

    .skeleton-list {
      display: grid;
      gap: 0.55rem;
    }

    .skeleton-row {
      height: 60px;
      border-radius: var(--radius-sm);
      border: 1px solid hsl(var(--brand-h) 34% 74% / 0.52);
      background:
        linear-gradient(
          90deg,
          hsl(var(--brand-h) 24% 92% / 0.72) 0%,
          hsl(var(--brand-h) 28% 96% / 0.9) 50%,
          hsl(var(--brand-h) 24% 92% / 0.72) 100%
        );
      background-size: 200% 100%;
      animation: checkout-skeleton-shimmer 1.2s linear infinite;
    }

    .loading-inline {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      color: var(--muted);
    }

    .checkout-trust {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.45rem;
      margin-top: 0.65rem;
      padding: 0;
      list-style: none;
    }

    .checkout-trust__item {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 0.56rem;
      border-radius: var(--radius-sm);
      border: 1px solid hsl(var(--brand-h) 34% 72% / 0.54);
      background: hsl(0 0% 100% / 0.74);
      color: var(--muted);
      font-size: 0.83rem;
      font-weight: 600;
    }

    .checkout-trust__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.1rem;
      height: 1.45rem;
      border-radius: 999px;
      border: 1px solid hsl(var(--brand-h) 34% 70% / 0.54);
      background: hsl(var(--brand-h) 44% 95% / 0.95);
      color: hsl(var(--brand-h) 38% 22%);
      font-size: 0.69rem;
      letter-spacing: 0.04em;
      font-weight: 700;
    }

    .spinner {
      width: 1rem;
      height: 1rem;
      border-radius: 999px;
      border: 2px solid hsl(var(--brand-h) 34% 74% / 0.72);
      border-top-color: hsl(var(--h2) 65% 45%);
      animation: checkout-spin 0.85s linear infinite;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .payment-card .sr-only:focus-visible + .payment-card__icon {
      box-shadow: var(--ring);
    }

    @keyframes checkout-spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes checkout-skeleton-shimmer {
      from {
        background-position: 200% 0;
      }
      to {
        background-position: -200% 0;
      }
    }

    @media (max-width: 640px) {
      .checkout-item {
        grid-template-columns: 46px 1fr;
      }
    }
  `,
})
export class CheckoutPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly analytics = inject(AnalyticsService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stateKey = 'gt_checkout_state_v1';

  submitted = signal(false);
  message = signal('');
  submitting = signal(false);
  currentStep = signal<1 | 2 | 3 | 4>(1);
  quote = signal<OrderQuote | null>(null);
  quoteLoading = signal(false);
  quoteError = signal('');
  postalLookupLoading = signal(false);
  postalLookupMessage = signal('');
  shippingMapUrl = signal<SafeResourceUrl | null>(null);
  completedOrder = signal<Order | null>(null);
  appliedCoupon = signal<string | undefined>(undefined);
  private idempotencyKey = signal<string | undefined>(undefined);
  private idempotencyBasis = signal<string | undefined>(undefined);

  private quoteTimer: number | null = null;
  private quoteSeq = 0;
  private postalLookupSeq = 0;
  private lastPostalLookup = '';
  private beginTracked = false;

  readonly checkoutSteps = [
    { id: 1 as const, title: 'Resumen', caption: 'Productos y precio' },
    { id: 2 as const, title: 'Envio', caption: 'Mapa y costo' },
    { id: 3 as const, title: 'Pago', caption: 'Metodo y datos' },
    { id: 4 as const, title: 'Recibo', caption: 'Estados por email' },
  ];
  readonly paymentOptions: ReadonlyArray<{
    value: PaymentMethod;
    label: string;
    description: string;
    icon: string;
  }> = [
    {
      value: 'MERCADOPAGO',
      label: 'Mercado Pago',
      description: 'Pago online con tarjeta, saldo o transferencia.',
      icon: 'MP',
    },
    {
      value: 'TRANSFER',
      label: 'Transferencia',
      description: 'Te enviamos los datos para transferir.',
      icon: 'TR',
    },
    {
      value: 'CASH',
      label: 'Efectivo',
      description: 'Pago en efectivo al retirar o coordinar.',
      icon: '$',
    },
  ];

  guestLoading = computed(() => this.cart.guestLoading());
  activeLines = computed(() => this.cart.activeLines());
  cartSubtotal = computed(() => this.cart.activeTotal());

  displaySubtotal = computed(() => this.quote()?.subtotal ?? this.cartSubtotal());
  displayDiscount = computed(() => this.quote()?.discount ?? 0);
  displayShippingCost = computed(() => this.quote()?.shippingCost ?? 0);
  displayShippingProvider = computed(() => this.quote()?.shippingProvider ?? '');
  displayTotal = computed(() => this.quote()?.total ?? this.cartSubtotal());

  form = this.fb.group({
    couponCode: [''],
    shippingCity: ['', [Validators.maxLength(120)]],
    shippingPostalCode: [
      '',
      [Validators.maxLength(10), Validators.pattern(/^(?:[A-Za-z]\d{4}[A-Za-z]{0,3}|\d{4,8})$/)],
    ],
    paymentMethod: ['TRANSFER', [Validators.required]],
    notes: [''],
    guestEmail: ['', [Validators.email, Validators.required]],
    guestFirstName: ['', [Validators.required]],
    guestLastName: ['', [Validators.required]],
    rememberGuest: [false],
  });

  ngOnInit() {
    this.restoreState();
    this.updateShippingMapUrl();

    if (this.auth.isLoggedIn()) {
      this.cart.refreshServerCart().subscribe();
    } else {
      this.cart.ensureGuestProductsLoaded();
    }

    this.form.valueChanges
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.maybeClearIdempotencyKey();
        this.updateShippingMapUrl();
        if (this.normalizeShippingCity(this.form.getRawValue().shippingCity)) {
          this.postalLookupMessage.set('');
        } else {
          this.lastPostalLookup = '';
        }
        this.persistState();
      });

    this.form.controls.shippingPostalCode.valueChanges
      .pipe(debounceTime(450), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.tryCityAutofillByPostalCode(value);
      });

    effect(
      () => {
        // Keep applied coupon persistence in sync too.
        void this.appliedCoupon();
        void this.currentStep();
        this.maybeClearIdempotencyKey();
        this.persistState();
      },
      { injector: this.injector },
    );

    effect(
      () => {
        const lines = this.activeLines();
        const coupon = this.appliedCoupon();
        const loggedIn = this.auth.isLoggedIn();
        const cleared = this.maybeClearIdempotencyKey();
        if (cleared) {
          this.persistState();
        }

        if (loggedIn) {
          const server = this.cart.serverCart();
          if (!server) {
            // Still loading server cart.
            return;
          }
          if (server.items.length === 0) {
            this.quote.set(null);
            this.quoteError.set('');
            this.clearState();
            if (!this.completedOrder()) {
              this.currentStep.set(1);
            }
            return;
          }
        } else {
          const guestCount = this.cart.guestItems().length;
          if (guestCount === 0) {
            this.quote.set(null);
            this.quoteError.set('');
            this.clearState();
            if (!this.completedOrder()) {
              this.currentStep.set(1);
            }
            return;
          }
          if (this.guestLoading() && lines.length === 0) {
            // Guest cart exists but product details are still loading.
            return;
          }
        }

        if (lines.length === 0) {
          this.quote.set(null);
          this.quoteError.set('');
          return;
        }

        if (!this.beginTracked) {
          this.beginTracked = true;
          this.analytics.track('begin_checkout', {
            itemCount: lines.length,
            subtotal: this.cartSubtotal(),
            mode: loggedIn ? 'auth' : 'guest',
            couponUsed: !!coupon,
            paymentMethod: this.form.getRawValue().paymentMethod,
          });
        }

        // Re-quote on cart changes and when a coupon is applied (debounced).
        this.scheduleQuote();
      },
      { injector: this.injector },
    );
  }

  applyCoupon() {
    const next = this.normalizeCoupon(this.form.getRawValue().couponCode);
    this.appliedCoupon.set(next);
    this.analytics.track('coupon_apply_attempt', {
      mode: this.auth.isLoggedIn() ? 'auth' : 'guest',
      hasCode: !!next,
    });
    this.refreshQuote({ reason: 'apply_coupon' });
  }

  canJumpToStep(step: 1 | 2 | 3 | 4) {
    if (step === 1) {
      return true;
    }
    if (step === 2) {
      return this.activeLines().length > 0;
    }
    if (step === 3) {
      return this.currentStep() > 2 || this.isShippingInputValid();
    }
    return !!this.completedOrder();
  }

  goToStep(step: 1 | 2 | 3 | 4) {
    if (step === 4) {
      if (this.completedOrder()) {
        this.currentStep.set(4);
      }
      return;
    }
    if (step === 3) {
      if (!this.canProceedFromShipping()) {
        this.message.set('Completa ciudad y codigo postal para pasar a pago.');
        this.focusMessage();
        return;
      }
      this.currentStep.set(3);
      return;
    }
    this.currentStep.set(step);
  }

  refreshShippingQuote() {
    this.refreshQuote({ reason: 'shipping_refresh' });
  }

  submit() {
    if (this.submitting()) {
      return;
    }
    if (this.currentStep() !== 3) {
      if (this.currentStep() === 1) {
        this.goToStep(2);
      } else if (this.currentStep() === 2) {
        this.goToStep(3);
      }
      return;
    }
    this.submitted.set(true);

    const value = this.form.getRawValue();
    const couponCode = this.normalizeCoupon(value.couponCode);
    this.appliedCoupon.set(couponCode);
    const paymentMethod = this.normalizePaymentMethod(value.paymentMethod);
    const shippingCity = this.normalizeShippingCity(value.shippingCity);
    const shippingPostalCode = this.normalizeShippingPostalCode(value.shippingPostalCode);

    if (!shippingCity || !shippingPostalCode) {
      this.message.set('Completa ciudad y codigo postal para continuar con el pago.');
      this.currentStep.set(2);
      this.focusMessage();
      return;
    }

    this.submitting.set(true);

    if (!this.auth.isLoggedIn()) {
      if (!paymentMethod) {
        this.message.set('Selecciona un metodo de pago valido.');
        this.submitting.set(false);
        return;
      }

      const guestEmail =
        typeof value.guestEmail === 'string' ? value.guestEmail.trim().toLowerCase() : '';
      const guestFirstName =
        typeof value.guestFirstName === 'string' ? value.guestFirstName.trim() : '';
      const guestLastName =
        typeof value.guestLastName === 'string' ? value.guestLastName.trim() : '';

      this.form.patchValue(
        {
          guestEmail,
          guestFirstName,
          guestLastName,
          shippingCity: shippingCity ?? '',
          shippingPostalCode: shippingPostalCode ?? '',
        },
        { emitEvent: false },
      );

      if (this.form.invalid) {
        this.form.markAllAsTouched();
        this.message.set(
          'Revisa los campos obligatorios para continuar.',
        );
        this.submitting.set(false);
        this.focusFirstInvalidField();
        this.focusMessage();
        return;
      }

      this.persistState();

      if (!guestEmail || !guestFirstName || !guestLastName) {
        this.message.set('Completa tu email, nombre y apellido para continuar.');
        this.submitting.set(false);
        this.focusFirstInvalidField();
        this.focusMessage();
        return;
      }

      let idempotencyKey: string;
      try {
        idempotencyKey = this.ensureIdempotencyKey();
      } catch {
        this.message.set(
          'No pudimos preparar un identificador seguro para el pago en este navegador. Reintenta en una pestana moderna.',
        );
        this.submitting.set(false);
        this.focusMessage();
        return;
      }

      const items = this.cart.guestItems().map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      }));

      if (paymentMethod === 'MERCADOPAGO') {
        this.api
          .guestCheckoutMercadoPago(
            {
              items,
              couponCode,
              notes: value.notes ?? undefined,
              guestEmail,
              guestFirstName,
              guestLastName,
              shippingCity,
              shippingPostalCode,
            },
            { idempotencyKey },
          )
          .subscribe({
            next: (res) => {
              this.message.set('Redirigiendo a Mercado Pago...');
              this.analytics.track('checkout_redirect', {
                mode: 'guest',
                provider: 'mercadopago',
                orderId: res.orderId,
                total: this.displayTotal(),
                itemCount: this.activeLines().length,
              });
              this.analytics.flushNow('checkout_redirect');
              try {
                window.location.assign(res.redirectUrl);
              } catch {
                window.location.href = res.redirectUrl;
              }
            },
            error: (err) => {
              this.analytics.track('checkout_failed', { mode: 'guest' });
              this.message.set(this.mapApiErrorToMessage(err) ?? 'No se pudo iniciar el pago');
              this.submitting.set(false);
              this.focusMessage();
            },
            complete: () => {
              this.submitting.set(false);
            },
          });
        return;
      }

      this.api
        .guestCheckout({
          items,
          couponCode,
          paymentMethod,
          notes: value.notes ?? undefined,
          guestEmail,
          guestFirstName,
          guestLastName,
          shippingCity,
          shippingPostalCode,
        }, { idempotencyKey })
        .subscribe({
          next: (order) => {
            this.message.set('Pedido creado con exito');
            this.analytics.track('purchase_success', {
              mode: 'guest',
              orderId: order.id,
              total: this.displayTotal(),
              itemCount: this.activeLines().length,
              paymentMethod: order.paymentMethod ?? paymentMethod,
            });
            this.analytics.flushNow('purchase');
            this.completedOrder.set(order);
            this.clearState();
            this.cart.clear();
            this.currentStep.set(4);
          },
          error: (err) => {
            this.analytics.track('checkout_failed', { mode: 'guest' });
            this.message.set(this.mapApiErrorToMessage(err) ?? 'No se pudo crear el pedido');
            this.submitting.set(false);
            this.focusMessage();
          },
          complete: () => {
            this.submitting.set(false);
          },
        });

      return;
    }

    if (!paymentMethod) {
      this.message.set('Selecciona un metodo de pago valido.');
      this.submitting.set(false);
      this.focusMessage();
      return;
    }

    let idempotencyKey: string;
    try {
      idempotencyKey = this.ensureIdempotencyKey();
    } catch {
      this.message.set(
        'No pudimos preparar un identificador seguro para el pago en este navegador. Reintenta en una pestana moderna.',
      );
      this.submitting.set(false);
      this.focusMessage();
      return;
    }

    if (paymentMethod === 'MERCADOPAGO') {
      this.api
        .checkoutMercadoPago(
          {
            couponCode,
            notes: value.notes ?? undefined,
            shippingCity,
            shippingPostalCode,
          },
          { idempotencyKey },
        )
        .subscribe({
          next: (res) => {
            this.message.set('Redirigiendo a Mercado Pago...');
            this.analytics.track('checkout_redirect', {
              mode: 'auth',
              provider: 'mercadopago',
              orderId: res.orderId,
              total: this.displayTotal(),
              itemCount: this.activeLines().length,
            });
            this.analytics.flushNow('checkout_redirect');
            try {
              window.location.assign(res.redirectUrl);
            } catch {
              window.location.href = res.redirectUrl;
            }
          },
          error: (err) => {
            this.analytics.track('checkout_failed', { mode: 'auth' });
            this.message.set(this.mapApiErrorToMessage(err) ?? 'No se pudo iniciar el pago');
            this.submitting.set(false);
            this.focusMessage();
          },
          complete: () => {
            this.submitting.set(false);
          },
        });
      return;
    }

    this.api
      .checkout({
        couponCode,
        paymentMethod,
        notes: value.notes ?? undefined,
        shippingCity,
        shippingPostalCode,
      }, { idempotencyKey })
      .subscribe({
        next: (order) => {
          this.message.set('Pedido creado con exito');
          this.analytics.track('purchase_success', {
            mode: 'auth',
            total: this.displayTotal(),
            itemCount: this.activeLines().length,
            paymentMethod,
          });
          this.analytics.flushNow('purchase');
          this.completedOrder.set(order);
          this.clearState();
          this.cart.refreshServerCart().subscribe();
          this.currentStep.set(4);
        },
        error: (err) => {
          this.analytics.track('checkout_failed', { mode: 'auth' });
          this.message.set(this.mapApiErrorToMessage(err) ?? 'No se pudo crear el pedido');
          this.submitting.set(false);
          this.focusMessage();
        },
        complete: () => {
          this.submitting.set(false);
        },
      });
  }

  goLogin() {
    this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
  }

  goRegister() {
    this.router.navigate(['/register'], { queryParams: { returnUrl: '/checkout' } });
  }

  goCatalog() {
    this.router.navigateByUrl('/catalog');
  }

  goProfile() {
    this.router.navigateByUrl('/profile');
  }

  private canProceedFromShipping() {
    if (!this.isShippingInputValid()) {
      this.form.controls.shippingCity.markAsTouched();
      this.form.controls.shippingPostalCode.markAsTouched();
      return false;
    }

    if (this.quoteLoading()) {
      this.message.set('Estamos calculando el envio. Espera un momento.');
      this.focusMessage();
      return false;
    }

    if (this.quoteError()) {
      this.message.set(this.quoteError());
      this.focusMessage();
      return false;
    }

    return true;
  }

  private isShippingInputValid() {
    const value = this.form.getRawValue();
    const shippingCity = this.normalizeShippingCity(value.shippingCity);
    const shippingPostalCode = this.normalizeShippingPostalCode(value.shippingPostalCode);
    return !!shippingCity && !!shippingPostalCode;
  }

  private updateShippingMapUrl() {
    const value = this.form.getRawValue();
    const city = this.normalizeShippingCity(value.shippingCity);
    const cpRaw = typeof value.shippingPostalCode === 'string'
      ? value.shippingPostalCode.trim().toUpperCase().slice(0, 10)
      : '';

    if (!city && !cpRaw) {
      this.shippingMapUrl.set(null);
      return;
    }

    const query = [city, cpRaw, 'Argentina']
      .filter((chunk): chunk is string => typeof chunk === 'string' && chunk.length > 0)
      .join(', ');
    const url = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    this.shippingMapUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
  }

  private scheduleQuote() {
    if (this.quoteTimer) {
      clearTimeout(this.quoteTimer);
      this.quoteTimer = null;
    }

    const g = globalThis as unknown as { setTimeout?: typeof setTimeout };
    this.quoteTimer = g.setTimeout?.(() => this.refreshQuote({ reason: 'cart_change' }), 320) ?? null;
  }

  private refreshQuote(extra?: { reason?: string }) {
    if (this.quoteTimer) {
      clearTimeout(this.quoteTimer);
      this.quoteTimer = null;
    }

    if (this.activeLines().length === 0) {
      this.quote.set(null);
      this.quoteError.set('');
      return;
    }

    const seq = ++this.quoteSeq;
    const couponCode = this.appliedCoupon();
    const value = this.form.getRawValue();
    const shippingCity = this.normalizeShippingCity(value.shippingCity);
    const shippingPostalCode = this.normalizeShippingPostalCode(value.shippingPostalCode);
    const wantsShipping = this.hasShippingData(value.shippingCity, value.shippingPostalCode);
    const shippingHintError =
      wantsShipping && (!shippingCity || !shippingPostalCode)
        ? 'Completa ciudad y codigo postal validos para cotizar envio.'
        : '';

    this.quoteLoading.set(true);
    this.quoteError.set(shippingHintError);

    if (this.auth.isLoggedIn()) {
      this.api.quoteFromCart({
        couponCode,
        shippingCity: shippingCity ?? undefined,
        shippingPostalCode: shippingPostalCode ?? undefined,
      }).subscribe({
        next: (res) => {
          if (seq !== this.quoteSeq) {
            return;
          }
          this.quote.set(res);
          if (extra?.reason === 'apply_coupon') {
            this.analytics.track('coupon_apply_success', { mode: 'auth', applied: !!couponCode });
          }
        },
        error: (err) => {
          if (seq !== this.quoteSeq) {
            return;
          }
          const msg = this.mapApiErrorToMessage(err);
          this.quote.set(null);
          this.quoteError.set(msg ?? 'No se pudo calcular el total.');
          this.quoteLoading.set(false);
          if (extra?.reason === 'apply_coupon') {
            this.analytics.track('coupon_apply_failed', { mode: 'auth', applied: !!couponCode });
          }
        },
        complete: () => {
          if (seq !== this.quoteSeq) {
            return;
          }
          this.quoteLoading.set(false);
        },
      });
      return;
    }

    const items = this.cart.guestItems().map((i) => ({ productId: i.productId, quantity: i.quantity }));
    this.api.quoteGuest({
      items,
      couponCode,
      shippingCity: shippingCity ?? undefined,
      shippingPostalCode: shippingPostalCode ?? undefined,
    }).subscribe({
      next: (res) => {
        if (seq !== this.quoteSeq) {
          return;
        }
        this.quote.set(res);
        if (extra?.reason === 'apply_coupon') {
          this.analytics.track('coupon_apply_success', { mode: 'guest', applied: !!couponCode });
        }
      },
      error: (err) => {
        if (seq !== this.quoteSeq) {
          return;
        }
        const msg = this.mapApiErrorToMessage(err);
        this.quote.set(null);
        this.quoteError.set(msg ?? 'No se pudo calcular el total.');
        this.quoteLoading.set(false);
        if (extra?.reason === 'apply_coupon') {
          this.analytics.track('coupon_apply_failed', { mode: 'guest', applied: !!couponCode });
        }
      },
      complete: () => {
        if (seq !== this.quoteSeq) {
          return;
        }
        this.quoteLoading.set(false);
      },
    });
  }

  private normalizeCoupon(input: unknown): string | undefined {
    if (typeof input !== 'string') {
      return undefined;
    }
    const trimmed = input.trim();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.toUpperCase();
  }

  private normalizeShippingCity(input: unknown): string | undefined {
    if (typeof input !== 'string') {
      return undefined;
    }
    const trimmed = input.trim();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.slice(0, 120);
  }

  private normalizeShippingPostalCode(input: unknown): string | undefined {
    if (typeof input !== 'string') {
      return undefined;
    }
    const trimmed = input.trim().toUpperCase();
    if (!trimmed) {
      return undefined;
    }
    if (!/^(?:[A-Z]\d{4}[A-Z]{0,3}|\d{4,8})$/.test(trimmed)) {
      return undefined;
    }
    return trimmed.slice(0, 10);
  }

  private normalizePostalCodeForLookup(input: unknown): string | undefined {
    if (typeof input !== 'string') {
      return undefined;
    }

    const trimmed = input.trim().toUpperCase();
    if (!trimmed) {
      return undefined;
    }

    if (/^\d{4,8}$/.test(trimmed)) {
      return trimmed;
    }

    const cpa = /^([A-Z])(\d{4})([A-Z]{0,3})$/.exec(trimmed);
    if (cpa) {
      return cpa[2];
    }

    return undefined;
  }

  private tryCityAutofillByPostalCode(rawPostalCode: unknown) {
    const cityAlreadyPresent = this.normalizeShippingCity(this.form.controls.shippingCity.value);
    const lookupPostalCode = this.normalizePostalCodeForLookup(rawPostalCode);

    if (!lookupPostalCode || cityAlreadyPresent) {
      this.postalLookupLoading.set(false);
      if (!cityAlreadyPresent) {
        this.postalLookupMessage.set('');
      }
      return;
    }

    if (lookupPostalCode === this.lastPostalLookup) {
      return;
    }

    this.lastPostalLookup = lookupPostalCode;
    void this.fetchCitySuggestionByPostalCode(lookupPostalCode);
  }

  private async fetchCitySuggestionByPostalCode(postalCode: string) {
    const seq = ++this.postalLookupSeq;
    this.postalLookupLoading.set(true);
    this.postalLookupMessage.set('');

    const g = globalThis as unknown as {
      fetch?: typeof fetch;
      AbortController?: typeof AbortController;
      setTimeout?: typeof setTimeout;
      clearTimeout?: typeof clearTimeout;
    };

    if (!g.fetch) {
      this.postalLookupLoading.set(false);
      return;
    }

    const controller = g.AbortController ? new g.AbortController() : undefined;
    const timer = g.setTimeout?.(() => controller?.abort(), 3500);

    try {
      const url =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1` +
        `&limit=1&country=Argentina&postalcode=${encodeURIComponent(postalCode)}`;

      const res = await g.fetch(url, {
        method: 'GET',
        signal: controller?.signal,
      });

      if (seq !== this.postalLookupSeq) {
        return;
      }
      if (!res.ok) {
        this.postalLookupMessage.set('');
        return;
      }

      const payload = (await res.json()) as Array<{
        address?: Record<string, string>;
      }>;
      const address = payload?.[0]?.address;
      const cityCandidate =
        address?.['city'] ??
        address?.['town'] ??
        address?.['village'] ??
        address?.['municipality'] ??
        '';
      const provinceCandidate = address?.['state'] ?? address?.['region'] ?? '';
      const city = this.normalizeShippingCity(cityCandidate);
      if (!city) {
        this.postalLookupMessage.set('');
        return;
      }

      if (!this.normalizeShippingCity(this.form.controls.shippingCity.value)) {
        this.form.controls.shippingCity.setValue(city);
      }

      this.postalLookupMessage.set(
        provinceCandidate
          ? `Sugerencia automatica: ${city}, ${provinceCandidate}.`
          : `Sugerencia automatica: ${city}.`,
      );
    } catch {
      if (seq === this.postalLookupSeq) {
        this.postalLookupMessage.set('');
      }
    } finally {
      if (timer) {
        g.clearTimeout?.(timer);
      }
      if (seq === this.postalLookupSeq) {
        this.postalLookupLoading.set(false);
      }
    }
  }

  private hasShippingData(city: unknown, postalCode: unknown): boolean {
    return (
      (typeof city === 'string' && city.trim().length > 0) ||
      (typeof postalCode === 'string' && postalCode.trim().length > 0)
    );
  }

  private normalizePaymentMethod(input: unknown): PaymentMethod | undefined {
    if (input === 'CASH' || input === 'TRANSFER' || input === 'MERCADOPAGO') {
      return input;
    }
    return undefined;
  }

  private mapApiErrorToMessage(err: unknown): string | undefined {
    const apiError = this.extractApiError(err);
    const message = apiError.message;
    const errorCode = apiError.code?.trim().toUpperCase();

    if (errorCode === 'CHECKOUT_ALREADY_PROCESSED' || message === 'Checkout already processed') {
      return 'Este pedido ya fue procesado. Si no lo ves reflejado, recarga la pagina o revisa tu perfil.';
    }
    if (
      errorCode === 'IDEMPOTENCY_KEY_REUSED' ||
      message === 'Idempotency-Key reused with a different request'
    ) {
      return 'Detectamos un reintento con datos distintos. Actualiza el carrito/cupon y vuelve a confirmar.';
    }

    if (errorCode === 'COUPON_INVALID' || message === 'Invalid coupon') {
      return 'Cupon invalido.';
    }
    if (errorCode === 'COUPON_EXPIRED' || message === 'Coupon expired') {
      return 'El cupon ya vencio.';
    }
    if (errorCode === 'COUPON_NOT_ACTIVE' || message === 'Coupon not active yet') {
      return 'El cupon todavia no esta activo.';
    }
    if (errorCode === 'COUPON_USAGE_LIMIT_REACHED' || message === 'Coupon usage limit reached') {
      return 'El cupon ya alcanzo su limite de uso.';
    }
    if (errorCode === 'CART_EMPTY' || message === 'Cart is empty') {
      return 'Tu carrito esta vacio.';
    }
    if (
      errorCode === 'SHIPPING_CITY_POSTAL_REQUIRED' ||
      message === 'Shipping city and postal code are required'
    ) {
      return 'Completa ciudad y codigo postal para cotizar el envio.';
    }
    if (errorCode === 'SHIPPING_POSTAL_CODE_INVALID' || message === 'Shipping postal code is invalid') {
      return 'El codigo postal no es valido.';
    }
    if (errorCode === 'SHIPPING_PROVIDER_UNAVAILABLE' || message === 'Shipping provider unavailable') {
      return 'El cotizador de envio no esta disponible ahora.';
    }
    if (message?.toLowerCase().includes('andreani')) {
      return 'No se pudo cotizar envio con Andreani. Verifica ciudad/CP o intenta mas tarde.';
    }
    if (
      errorCode === 'INSUFFICIENT_STOCK' ||
      message?.toLowerCase().includes('insufficient stock')
    ) {
      return 'No hay stock suficiente para completar la compra.';
    }
    if (
      errorCode === 'PRODUCT_NOT_AVAILABLE' ||
      message?.toLowerCase().includes('product not available')
    ) {
      return 'Hay productos que ya no estan disponibles.';
    }

    return message;
  }

  private extractApiError(err: unknown): { message?: string; code?: string } {
    const anyErr = err as { error?: unknown };
    const payload = anyErr?.error as
      | { message?: unknown; code?: unknown; errorCode?: unknown }
      | undefined;

    const code =
      typeof payload?.code === 'string'
        ? payload.code
        : typeof payload?.errorCode === 'string'
          ? payload.errorCode
          : undefined;

    const msg = payload?.message;
    if (typeof msg === 'string') {
      return { message: msg, code };
    }
    if (Array.isArray(msg) && msg.length > 0 && typeof msg[0] === 'string') {
      return { message: msg[0], code };
    }
    return { code };
  }

  private restoreState() {
    try {
      const raw = sessionStorage.getItem(this.stateKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as unknown as {
        updatedAt?: number;
        currentStep?: number;
        couponCode?: string;
        paymentMethod?: string;
        appliedCoupon?: string;
        shippingCity?: string;
        shippingPostalCode?: string;
        guestEmail?: string;
        guestFirstName?: string;
        guestLastName?: string;
        rememberGuest?: boolean;
      };

      if (!parsed || typeof parsed !== 'object') {
        return;
      }

      if (typeof parsed.updatedAt === 'number') {
        const maxAgeMs = 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.updatedAt > maxAgeMs) {
          sessionStorage.removeItem(this.stateKey);
          return;
        }
      }

      const rememberGuest = parsed.rememberGuest === true;
      const restoredStep =
        parsed.currentStep === 2 || parsed.currentStep === 3 ? parsed.currentStep : 1;
      this.currentStep.set(restoredStep);

      this.form.patchValue(
        {
          couponCode: typeof parsed.couponCode === 'string' ? parsed.couponCode : '',
          shippingCity:
            typeof parsed.shippingCity === 'string' ? parsed.shippingCity : '',
          shippingPostalCode:
            typeof parsed.shippingPostalCode === 'string' ? parsed.shippingPostalCode : '',
          paymentMethod: this.normalizePaymentMethod(parsed.paymentMethod) ?? 'TRANSFER',
          guestEmail:
            rememberGuest && typeof parsed.guestEmail === 'string' ? parsed.guestEmail : '',
          guestFirstName:
            rememberGuest && typeof parsed.guestFirstName === 'string'
              ? parsed.guestFirstName
              : '',
          guestLastName:
            rememberGuest && typeof parsed.guestLastName === 'string'
              ? parsed.guestLastName
              : '',
          rememberGuest,
        },
        { emitEvent: false },
      );

      const applied =
        typeof parsed.appliedCoupon === 'string' && parsed.appliedCoupon.trim()
          ? parsed.appliedCoupon.trim().toUpperCase()
          : undefined;
      this.appliedCoupon.set(applied);
    } catch {
      // Ignore invalid storage.
    }
  }

  private persistState() {
    try {
      const value = this.form.getRawValue();
      const rememberGuest = value.rememberGuest === true;
      const payload = {
        updatedAt: Date.now(),
        currentStep: this.currentStep() >= 4 ? 3 : this.currentStep(),
        couponCode: typeof value.couponCode === 'string' ? value.couponCode : '',
        shippingCity:
          typeof value.shippingCity === 'string' ? value.shippingCity : '',
        shippingPostalCode:
          typeof value.shippingPostalCode === 'string' ? value.shippingPostalCode : '',
        paymentMethod: this.normalizePaymentMethod(value.paymentMethod),
        appliedCoupon: this.appliedCoupon(),
        guestEmail:
          rememberGuest && typeof value.guestEmail === 'string' ? value.guestEmail : '',
        guestFirstName:
          rememberGuest && typeof value.guestFirstName === 'string'
            ? value.guestFirstName
            : '',
        guestLastName:
          rememberGuest && typeof value.guestLastName === 'string'
            ? value.guestLastName
            : '',
        rememberGuest,
      };
      sessionStorage.setItem(this.stateKey, JSON.stringify(payload));
    } catch {
      // Ignore storage failures (private mode, etc.)
    }
  }

  private clearState() {
    try {
      sessionStorage.removeItem(this.stateKey);
    } catch {
      // ignore
    }
    this.submitted.set(false);
    this.idempotencyKey.set(undefined);
    this.idempotencyBasis.set(undefined);
  }

  guestEmailInvalid() {
    const ctrl = this.form.controls.guestEmail;
    return ctrl.invalid && (ctrl.touched || this.submitted());
  }

  guestEmailErrorMessage() {
    const errors = this.form.controls.guestEmail.errors;
    if (errors?.['required']) {
      return 'Ingresa tu email.';
    }
    if (errors?.['email']) {
      return 'Ingresa un email valido (ej: nombre@dominio.com).';
    }
    return 'Revisa el email.';
  }

  shippingPostalCodeInvalid() {
    const ctrl = this.form.controls.shippingPostalCode;
    const value = typeof ctrl.value === 'string' ? ctrl.value.trim() : '';
    if (!value) {
      return false;
    }
    return ctrl.invalid && (ctrl.touched || this.submitted());
  }

  private focusFirstInvalidField() {
    const controlsInOrder: ReadonlyArray<{
      id: string;
      invalid: boolean;
    }> = [
      { id: 'shippingCity', invalid: this.form.controls.shippingCity.invalid },
      { id: 'shippingPostalCode', invalid: this.form.controls.shippingPostalCode.invalid },
      { id: 'guestEmail', invalid: this.form.controls.guestEmail.invalid },
      { id: 'guestFirstName', invalid: this.form.controls.guestFirstName.invalid },
      { id: 'guestLastName', invalid: this.form.controls.guestLastName.invalid },
    ];

    const target = controlsInOrder.find((entry) => entry.invalid);
    if (!target) {
      return;
    }

    const g = globalThis as unknown as { document?: Document; setTimeout?: typeof setTimeout };
    g.setTimeout?.(() => {
      const node = g.document?.getElementById(target.id);
      if (node instanceof HTMLElement) {
        node.focus();
      }
    }, 0);
  }

  private focusMessage() {
    const g = globalThis as unknown as { document?: Document; setTimeout?: typeof setTimeout };
    g.setTimeout?.(() => {
      const node = g.document?.getElementById('checkout-message');
      if (node instanceof HTMLElement) {
        node.focus();
      }
    }, 0);
  }

  private ensureIdempotencyKey(): string {
    const basis = this.buildIdempotencyBasis();
    const existingKey = this.idempotencyKey();
    const existingBasis = this.idempotencyBasis();

    if (basis && existingKey && existingBasis === basis) {
      return existingKey;
    }

    const next = this.generateIdempotencyKey();
    this.idempotencyKey.set(next);
    this.idempotencyBasis.set(basis ?? `unknown:${Date.now()}`);
    this.persistState();
    return next;
  }

  private maybeClearIdempotencyKey(): boolean {
    if (this.submitting()) {
      return false;
    }

    const key = this.idempotencyKey();
    const basis = this.idempotencyBasis();
    if (!key || !basis) {
      return false;
    }

    const current = this.buildIdempotencyBasis();
    if (!current) {
      return false;
    }

    if (current === basis) {
      return false;
    }

    this.idempotencyKey.set(undefined);
    this.idempotencyBasis.set(undefined);
    return true;
  }

  private buildIdempotencyBasis(): string | null {
    const loggedIn = this.auth.isLoggedIn();

    const cartItems = loggedIn
      ? this.cart.serverCart()?.items?.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      : this.cart.guestItems();

    if (loggedIn && !cartItems) {
      // Avoid clearing idempotency keys while server cart is still loading.
      return null;
    }

    const cartFingerprint = (cartItems ?? [])
      .map((i) => `${i.productId}:${i.quantity}`)
      .sort()
      .join('|');

    const value = this.form.getRawValue();
    const guestEmail = !loggedIn && typeof value.guestEmail === 'string'
      ? value.guestEmail.trim().toLowerCase()
      : '';
    const shippingCity = this.normalizeShippingCity(value.shippingCity) ?? '';
    const shippingPostalCode = this.normalizeShippingPostalCode(value.shippingPostalCode) ?? '';

    const payload = {
      mode: loggedIn ? 'auth' : 'guest',
      cart: cartFingerprint,
      couponCode: this.appliedCoupon() ?? '',
      paymentMethod: this.normalizePaymentMethod(value.paymentMethod) ?? '',
      guestEmail,
      shippingCity,
      shippingPostalCode,
    };

    return JSON.stringify(payload);
  }

  private generateIdempotencyKey(): string {
    const g = globalThis as unknown as { crypto?: Crypto };
    try {
      const uuid = g.crypto?.randomUUID?.();
      if (uuid) {
        return uuid;
      }
    } catch {
      // ignore
    }

    try {
      const bytes = new Uint8Array(16);
      g.crypto?.getRandomValues?.(bytes);
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      throw new Error('Secure random generator unavailable');
    }
  }
}
