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
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { AnalyticsService } from '../core/analytics.service';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import type { OrderQuote, PaymentMethod } from '../core/models';

function guestEmailMatchValidator(control: AbstractControl): ValidationErrors | null {
  const email = control.get('guestEmail')?.value;
  const confirm = control.get('guestEmailConfirm')?.value;

  if (typeof email !== 'string' || typeof confirm !== 'string') {
    return null;
  }
  if (!email || !confirm) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedConfirm = confirm.trim().toLowerCase();
  return normalizedEmail === normalizedConfirm ? null : { guestEmailMismatch: true };
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-stack">
      <section class="card panel panel--wide">
        <h2>Checkout</h2>

        @if (guestLoading()) {
          <p class="muted">Cargando productos del carrito...</p>
        } @else if (activeLines().length === 0) {
          <p class="muted">No hay items en el carrito.</p>
        } @else {
          <h3>Resumen</h3>
          <ul class="admin-list">
            @for (item of activeLines(); track item.key) {
              <li class="admin-list__item">
                <div class="cart-row__main">
                  <strong>{{ item.product.title }}</strong>
                  <span class="muted">x{{ item.quantity }}</span>
                </div>
                <span class="muted">{{ item.product.price * item.quantity }} USD</span>
              </li>
            }
          </ul>

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
            <div class="checkout__line checkout__line--total">
              <span class="muted">Total</span>
              <strong>{{ displayTotal() }} USD</strong>
            </div>
            @if (quoteLoading()) {
              <p class="muted">Calculando total...</p>
            }
            @if (quoteError()) {
              <p class="muted">{{ quoteError() }}</p>
            }
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()">
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

          <label for="paymentMethod">Metodo de pago</label>
          <select id="paymentMethod" formControlName="paymentMethod" aria-describedby="paymentMethodHint">
            <option value="MERCADOPAGO">Mercado Pago</option>
            <option value="TRANSFER">Transferencia</option>
            <option value="CASH">Efectivo</option>
          </select>
          <p id="paymentMethodHint" class="field-msg field-msg--hint">
            @if (form.get('paymentMethod')?.value === 'MERCADOPAGO') {
              Te vamos a redirigir a Mercado Pago para completar el pago.
            } @else {
              El pedido queda en estado PENDIENTE hasta que confirmemos el pago.
            }
          </p>

          @if (!auth.isLoggedIn()) {
            <h3>Datos del comprador</h3>
            <p class="muted">
              Podes comprar como invitado. Si despues creas una cuenta, ya vas a conocer
              la tienda y tu experiencia va a ser mas rapida.
            </p>

            <label for="guestEmail">Email</label>
            <input
              id="guestEmail"
              formControlName="guestEmail"
              type="email"
              autocomplete="email"
              inputmode="email"
              [attr.aria-invalid]="guestEmailInvalid()"
            />
            @if (guestEmailInvalid()) {
              <p class="field-msg field-msg--error">{{ guestEmailErrorMessage() }}</p>
            } @else {
              <p class="field-msg field-msg--hint">
                A este email te enviamos confirmaciones y links de pago.
              </p>
            }

            <label for="guestEmailConfirm">Repetir email</label>
            <input
              id="guestEmailConfirm"
              formControlName="guestEmailConfirm"
              type="email"
              autocomplete="email"
              inputmode="email"
              [attr.aria-invalid]="guestEmailConfirmInvalid()"
            />
            @if (guestEmailConfirmInvalid()) {
              <p class="field-msg field-msg--error">
                {{ guestEmailConfirmErrorMessage() }}
              </p>
            } @else {
              <p class="field-msg field-msg--hint">Repetilo para evitar errores.</p>
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

            <button [disabled]="submitting()" type="submit">
              @if (auth.isLoggedIn()) { Confirmar pedido } @else { Comprar como invitado }
            </button>
          </form>

          @if (message()) {
            <p class="muted">{{ message() }}</p>
          }
        }
      </section>
    </section>
  `,
})
export class CheckoutPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly analytics = inject(AnalyticsService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly stateKey = 'gt_checkout_state_v1';

  submitted = signal(false);
  message = signal('');
  submitting = signal(false);
  quote = signal<OrderQuote | null>(null);
  quoteLoading = signal(false);
  quoteError = signal('');
  appliedCoupon = signal<string | undefined>(undefined);
  private idempotencyKey = signal<string | undefined>(undefined);
  private idempotencyBasis = signal<string | undefined>(undefined);

  private quoteTimer: number | null = null;
  private quoteSeq = 0;
  private beginTracked = false;

  guestLoading = computed(() => this.cart.guestLoading());
  activeLines = computed(() => this.cart.activeLines());
  cartSubtotal = computed(() => this.cart.activeTotal());

  displaySubtotal = computed(() => this.quote()?.subtotal ?? this.cartSubtotal());
  displayDiscount = computed(() => this.quote()?.discount ?? 0);
  displayTotal = computed(() => this.quote()?.total ?? this.cartSubtotal());

  form = this.fb.group({
    couponCode: [''],
    paymentMethod: ['TRANSFER', [Validators.required]],
    notes: [''],
    guestEmail: ['', [Validators.email, Validators.required]],
    guestEmailConfirm: ['', [Validators.email, Validators.required]],
    guestFirstName: ['', [Validators.required]],
    guestLastName: ['', [Validators.required]],
    rememberGuest: [false],
  }, { validators: [guestEmailMatchValidator] });

  ngOnInit() {
    this.restoreState();

    if (this.auth.isLoggedIn()) {
      this.cart.refreshServerCart().subscribe();
    } else {
      this.cart.ensureGuestProductsLoaded();
    }

    this.form.valueChanges
      .pipe(debounceTime(350), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.maybeClearIdempotencyKey();
        this.persistState();
      });

    effect(
      () => {
        // Keep applied coupon persistence in sync too.
        void this.appliedCoupon();
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
            return;
          }
        } else {
          const guestCount = this.cart.guestItems().length;
          if (guestCount === 0) {
            this.quote.set(null);
            this.quoteError.set('');
            this.clearState();
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

  submit() {
    if (this.submitting()) {
      return;
    }
    this.submitted.set(true);

    const value = this.form.getRawValue();
    const couponCode = this.normalizeCoupon(value.couponCode);
    this.appliedCoupon.set(couponCode);
    const paymentMethod = this.normalizePaymentMethod(value.paymentMethod);

    this.submitting.set(true);

    if (!this.auth.isLoggedIn()) {
      if (!paymentMethod) {
        this.message.set('Selecciona un metodo de pago valido.');
        this.submitting.set(false);
        return;
      }

      const guestEmail =
        typeof value.guestEmail === 'string' ? value.guestEmail.trim().toLowerCase() : '';
      const guestEmailConfirm =
        typeof value.guestEmailConfirm === 'string'
          ? value.guestEmailConfirm.trim().toLowerCase()
          : '';
      const guestFirstName =
        typeof value.guestFirstName === 'string' ? value.guestFirstName.trim() : '';
      const guestLastName =
        typeof value.guestLastName === 'string' ? value.guestLastName.trim() : '';

      this.form.patchValue(
        { guestEmail, guestEmailConfirm, guestFirstName, guestLastName },
        { emitEvent: false },
      );

      if (this.form.invalid) {
        this.form.markAllAsTouched();
        this.message.set('Revisa tu email. Debe ser valido y coincidir en ambos campos.');
        this.submitting.set(false);
        return;
      }

      this.persistState();

      if (!guestEmail || !guestEmailConfirm || !guestFirstName || !guestLastName) {
        this.message.set('Completa tu email (dos veces), nombre y apellido para continuar.');
        this.submitting.set(false);
        return;
      }

      const idempotencyKey = this.ensureIdempotencyKey();

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
            this.clearState();
            this.cart.clear();
            setTimeout(() => this.router.navigateByUrl('/'), 700);
          },
          error: (err) => {
            this.analytics.track('checkout_failed', { mode: 'guest' });
            this.message.set(this.mapApiErrorToMessage(err) ?? 'No se pudo crear el pedido');
            this.submitting.set(false);
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
      return;
    }

    const idempotencyKey = this.ensureIdempotencyKey();

    if (paymentMethod === 'MERCADOPAGO') {
      this.api
        .checkoutMercadoPago(
          {
            couponCode,
            notes: value.notes ?? undefined,
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
      }, { idempotencyKey })
      .subscribe({
        next: () => {
          this.message.set('Pedido creado con exito');
          this.analytics.track('purchase_success', {
            mode: 'auth',
            total: this.displayTotal(),
            itemCount: this.activeLines().length,
            paymentMethod,
          });
          this.analytics.flushNow('purchase');
          this.clearState();
          this.cart.refreshServerCart().subscribe();
          setTimeout(() => this.router.navigateByUrl('/profile'), 500);
        },
        error: (err) => {
          this.analytics.track('checkout_failed', { mode: 'auth' });
          this.message.set(this.mapApiErrorToMessage(err) ?? 'No se pudo crear el pedido');
          this.submitting.set(false);
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

    this.quoteLoading.set(true);
    this.quoteError.set('');

    if (this.auth.isLoggedIn()) {
      this.api.quoteFromCart({ couponCode }).subscribe({
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
    this.api.quoteGuest({ items, couponCode }).subscribe({
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

  private normalizePaymentMethod(input: unknown): PaymentMethod | undefined {
    if (input === 'CASH' || input === 'TRANSFER' || input === 'MERCADOPAGO') {
      return input;
    }
    return undefined;
  }

  private mapApiErrorToMessage(err: unknown): string | undefined {
    const message = this.extractApiErrorMessage(err);
    if (!message) {
      return undefined;
    }

    if (message === 'Checkout already processed') {
      return 'Este pedido ya fue procesado. Si no lo ves reflejado, recarga la pagina o revisa tu perfil.';
    }
    if (message === 'Idempotency-Key reused with a different request') {
      return 'Detectamos un reintento con datos distintos. Actualiza el carrito/cupon y vuelve a confirmar.';
    }

    if (message === 'Invalid coupon') {
      return 'Cupon invalido.';
    }
    if (message === 'Coupon expired') {
      return 'El cupon ya vencio.';
    }
    if (message === 'Coupon not active yet') {
      return 'El cupon todavia no esta activo.';
    }
    if (message === 'Coupon usage limit reached') {
      return 'El cupon ya alcanzo su limite de uso.';
    }
    if (message === 'Cart is empty') {
      return 'Tu carrito esta vacio.';
    }
    if (message.toLowerCase().includes('insufficient stock')) {
      return 'No hay stock suficiente para completar la compra.';
    }
    if (message.toLowerCase().includes('product not available')) {
      return 'Hay productos que ya no estan disponibles.';
    }

    return message;
  }

  private extractApiErrorMessage(err: unknown): string | undefined {
    const anyErr = err as { error?: unknown };
    const payload = anyErr?.error as { message?: unknown } | undefined;
    const msg = payload?.message;
    if (typeof msg === 'string') {
      return msg;
    }
    if (Array.isArray(msg) && msg.length > 0 && typeof msg[0] === 'string') {
      return msg[0];
    }
    return undefined;
  }

  private restoreState() {
    try {
      const raw = sessionStorage.getItem(this.stateKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as unknown as {
        updatedAt?: number;
        couponCode?: string;
        paymentMethod?: string;
        appliedCoupon?: string;
        notes?: string;
        idempotencyKey?: string;
        idempotencyBasis?: string;
        guestEmail?: string;
        guestEmailConfirm?: string;
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

      this.form.patchValue(
        {
          couponCode: typeof parsed.couponCode === 'string' ? parsed.couponCode : '',
          paymentMethod: this.normalizePaymentMethod(parsed.paymentMethod) ?? 'TRANSFER',
          notes: rememberGuest && typeof parsed.notes === 'string' ? parsed.notes : '',
          guestEmail:
            rememberGuest && typeof parsed.guestEmail === 'string' ? parsed.guestEmail : '',
          guestEmailConfirm:
            rememberGuest && typeof parsed.guestEmailConfirm === 'string'
              ? parsed.guestEmailConfirm
              : '',
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

      const idempotencyKey =
        typeof parsed.idempotencyKey === 'string' && parsed.idempotencyKey.trim().length <= 200
          ? parsed.idempotencyKey.trim()
          : undefined;
      const idempotencyBasis =
        typeof parsed.idempotencyBasis === 'string' && parsed.idempotencyBasis.trim()
          ? parsed.idempotencyBasis
          : undefined;
      this.idempotencyKey.set(idempotencyKey);
      this.idempotencyBasis.set(idempotencyBasis);
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
        couponCode: typeof value.couponCode === 'string' ? value.couponCode : '',
        paymentMethod: this.normalizePaymentMethod(value.paymentMethod),
        appliedCoupon: this.appliedCoupon(),
        notes: rememberGuest && typeof value.notes === 'string' ? value.notes : '',
        idempotencyKey: this.idempotencyKey(),
        idempotencyBasis: this.idempotencyBasis(),
        guestEmail:
          rememberGuest && typeof value.guestEmail === 'string' ? value.guestEmail : '',
        guestEmailConfirm:
          rememberGuest && typeof value.guestEmailConfirm === 'string'
            ? value.guestEmailConfirm
            : '',
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

  guestEmailConfirmInvalid() {
    const ctrl = this.form.controls.guestEmailConfirm;
    return (
      (ctrl.invalid || this.form.hasError('guestEmailMismatch')) &&
      (ctrl.touched || this.submitted())
    );
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

  guestEmailConfirmErrorMessage() {
    const errors = this.form.controls.guestEmailConfirm.errors;
    if (errors?.['required']) {
      return 'Repeti tu email.';
    }
    if (errors?.['email']) {
      return 'Ingresa un email valido (ej: nombre@dominio.com).';
    }
    if (this.form.hasError('guestEmailMismatch')) {
      return 'Los emails no coinciden.';
    }
    return 'Revisa el email.';
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

    const payload = {
      mode: loggedIn ? 'auth' : 'guest',
      cart: cartFingerprint,
      couponCode: this.appliedCoupon() ?? '',
      paymentMethod: this.normalizePaymentMethod(value.paymentMethod) ?? '',
      guestEmail,
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
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }
}
