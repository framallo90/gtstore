import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AnalyticsService } from './analytics.service';
import { AuthService } from './auth.service';
import type { CartItem, Product } from './models';
import { ToastService } from './toast.service';

export type GuestCartItem = { productId: string; quantity: number };
export type CartLine = {
  key: string;
  productId: string;
  quantity: number;
  product: Product;
  source: 'guest' | 'server';
};

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);
  private readonly toast = inject(ToastService);

  private readonly guestKey = 'gt_guest_cart_v1';

  guestItems = signal<GuestCartItem[]>(this.readGuestCart());
  guestProducts = signal<Product[]>([]);
  serverCart = signal<{ items: CartItem[]; total: number } | null>(null);

  guestLoading = signal(false);

  itemCount = computed(() => {
    if (this.auth.isLoggedIn()) {
      return (this.serverCart()?.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
    }
    return this.guestItems().reduce((sum, item) => sum + item.quantity, 0);
  });

  guestLines = computed(() => {
    const items = this.guestItems();
    const products = this.guestProducts();
    if (items.length === 0 || products.length === 0) {
      return [] as CartLine[];
    }

    const byId = new Map(products.map((p) => [p.id, p]));
    return items
      .map((i) => {
        const product = byId.get(i.productId);
        if (!product) {
          return null;
        }
        return {
          key: i.productId,
          productId: i.productId,
          quantity: i.quantity,
          product,
          source: 'guest' as const,
        } as CartLine;
      })
      .filter((x): x is CartLine => !!x);
  });

  guestTotal = computed(() => {
    return this.guestLines().reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  });

  serverLines = computed(() => {
    const items = this.serverCart()?.items ?? [];
    return items.map((i) => ({
      key: i.id,
      productId: i.productId,
      quantity: i.quantity,
      product: i.product,
      source: 'server' as const,
    }));
  });

  activeLines = computed(() => (this.auth.isLoggedIn() ? this.serverLines() : this.guestLines()));
  activeTotal = computed(() => (this.auth.isLoggedIn() ? this.serverCart()?.total ?? 0 : this.guestTotal()));

  init() {
    // Ensure guest cart is loaded early for header count.
    this.guestItems.set(this.readGuestCart());

    if (this.auth.isLoggedIn()) {
      this.syncGuestToServer().subscribe();
    } else if (this.guestItems().length > 0) {
      this.ensureGuestProductsLoaded();
    }
  }

  refreshServerCart() {
    if (!this.auth.isLoggedIn()) {
      this.serverCart.set(null);
      return of(null);
    }

    return this.api.getCart().pipe(
      tap((res) => this.serverCart.set(res)),
      catchError(() => of(null)),
    );
  }

  ensureGuestProductsLoaded() {
    if (this.auth.isLoggedIn()) {
      return;
    }
    const ids = Array.from(new Set(this.guestItems().map((i) => i.productId))).slice(
      0,
      200,
    );
    if (ids.length === 0) {
      return;
    }

    const loaded = new Set(this.guestProducts().map((p) => p.id));
    const missing = ids.filter((id) => !loaded.has(id));
    if (missing.length === 0 || this.guestLoading()) {
      return;
    }

    this.guestLoading.set(true);
    this.api.lookupProducts(missing).subscribe({
      next: (res) => {
        this.guestProducts.update((current) => {
          const byId = new Map(current.map((p) => [p.id, p]));
          for (const p of res) {
            byId.set(p.id, p);
          }
          return Array.from(byId.values());
        });
      },
      error: () => this.guestLoading.set(false),
      complete: () => this.guestLoading.set(false),
    });
  }

  add(product: Product, quantity = 1, opts?: { toast?: boolean }) {
    if (quantity <= 0) {
      return;
    }

    this.analytics.track('add_to_cart', {
      productId: product.id,
      quantity,
      price: product.price,
      stock: product.stock,
      type: product.type,
    });

    if (!this.auth.isLoggedIn()) {
      this.guestAdd(product, quantity);
      this.ensureGuestProductsLoaded();
      if (opts?.toast !== false) {
        this.toast.show({
          variant: 'success',
          message: `Agregado: ${product.title}`,
          thumbnailUrl: product.coverUrl ?? undefined,
          thumbnailAlt: product.title,
          actions: [
            { label: 'Ver carrito', href: '/cart' },
            { label: 'Checkout', href: '/checkout' },
          ],
        });
      }
      return;
    }

    const proceed = () => {
      const currentItems = this.serverCart()?.items ?? [];
      const existingQty = currentItems.find((i) => i.productId === product.id)?.quantity ?? 0;
      const nextQty = Math.min(existingQty + quantity, Math.max(0, product.stock));

      this.api
        .upsertCartItem(product.id, nextQty)
        .pipe(
          switchMap(() => this.api.getCart()),
          tap((res) => this.serverCart.set(res)),
        )
        .subscribe({
          next: () => {
            if (opts?.toast !== false) {
              this.toast.show({
                variant: 'success',
                message: `Agregado: ${product.title}`,
                thumbnailUrl: product.coverUrl ?? undefined,
                thumbnailAlt: product.title,
                actions: [
                  { label: 'Ver carrito', href: '/cart' },
                  { label: 'Checkout', href: '/checkout' },
                ],
              });
            }
          },
          error: () => {
            this.analytics.track('add_to_cart_failed', {
              productId: product.id,
              quantity,
            });
            this.toast.show({
              variant: 'error',
              message: 'No se pudo agregar al carrito (sin stock o error de red).',
              actions: [{ label: 'Ver carrito', href: '/cart' }],
            });
          },
        });
    };

    if (!this.serverCart()) {
      this.refreshServerCart().subscribe(() => proceed());
      return;
    }

    proceed();
  }

  setQuantity(productId: string, quantity: number) {
    if (!this.auth.isLoggedIn()) {
      this.guestSetQuantity(productId, quantity);
      this.ensureGuestProductsLoaded();
      this.analytics.track('qty_change', { productId, quantity, mode: 'guest' });
      return;
    }

    if (quantity <= 0) {
      this.remove(productId);
      return;
    }

    this.analytics.track('qty_change', { productId, quantity, mode: 'server' });
    this.api
      .upsertCartItem(productId, quantity)
      .pipe(
        switchMap(() => this.api.getCart()),
        tap((res) => this.serverCart.set(res)),
        catchError(() => of(null)),
      )
      .subscribe();
  }

  remove(productId: string) {
    if (!this.auth.isLoggedIn()) {
      this.guestSetQuantity(productId, 0);
      this.analytics.track('remove_from_cart', { productId, mode: 'guest' });
      return;
    }

    this.analytics.track('remove_from_cart', { productId, mode: 'server' });
    this.api
      .removeCartItem(productId)
      .pipe(
        switchMap(() => this.api.getCart()),
        tap((res) => this.serverCart.set(res)),
        catchError(() => of(null)),
      )
      .subscribe();
  }

  clear() {
    if (!this.auth.isLoggedIn()) {
      this.guestItems.set([]);
      this.writeGuestCart([]);
      this.guestProducts.set([]);
      this.analytics.track('cart_clear', { mode: 'guest' });
      return;
    }

    this.api
      .clearCart()
      .pipe(
        switchMap(() => this.api.getCart()),
        tap((res) => this.serverCart.set(res)),
        catchError(() => of(null)),
      )
      .subscribe(() => {
        this.analytics.track('cart_clear', { mode: 'server' });
      });
  }

  syncGuestToServer() {
    if (!this.auth.isLoggedIn()) {
      return of(void 0);
    }

    const items = this.guestItems();
    if (items.length === 0) {
      return this.refreshServerCart().pipe(map(() => void 0));
    }

    const before = items.slice();
    const serverBefore = (this.serverCart()?.items ?? []).map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    }));

    return this.api.syncCart(items).pipe(
      tap((res) => {
        this.serverCart.set(res);
        this.guestItems.set([]);
        this.writeGuestCart([]);
      }),
      tap(() => {
        this.analytics.track('cart_sync', { itemsCount: items.length });
      }),
      tap((res) => {
        const beforeById = new Map(before.map((i) => [i.productId, i.quantity]));
        const serverBeforeById = new Map(serverBefore.map((i) => [i.productId, i.quantity]));
        const afterById = new Map(res.items.map((i) => [i.productId, i.quantity]));

        let clamped = false;
        for (const [productId, guestQty] of beforeById.entries()) {
          const prevQty = serverBeforeById.get(productId) ?? 0;
          const expected = prevQty + guestQty;
          const after = afterById.get(productId) ?? prevQty;
          if (after < expected) {
            clamped = true;
            break;
          }
        }

        if (clamped) {
          this.analytics.track('cart_sync_clamped', { itemsCount: before.length });
          this.toast.show({
            variant: 'info',
            message: 'Ajustamos tu carrito por stock disponible.',
            actions: [
              { label: 'Ver carrito', href: '/cart' },
              { label: 'Checkout', href: '/checkout' },
            ],
          });
        }
      }),
      map(() => void 0),
      catchError(() => this.refreshServerCart().pipe(map(() => void 0))),
    );
  }

  private guestAdd(product: Product, addQty: number) {
    const items = this.guestItems();
    const existing = items.find((i) => i.productId === product.id);
    const requested = (existing?.quantity ?? 0) + addQty;
    const nextQty = Math.min(requested, Math.max(0, product.stock));

    if (nextQty < requested) {
      this.analytics.track('add_to_cart_clamped', {
        productId: product.id,
        requested,
        applied: nextQty,
      });
      this.toast.show({
        variant: 'info',
        message: 'Alcanzaste el maximo disponible en stock.',
        actions: [{ label: 'Ver carrito', href: '/cart' }],
        timeoutMs: 3200,
      });
    }

    const next = nextQty <= 0
      ? items.filter((i) => i.productId !== product.id)
      : existing
        ? items.map((i) =>
            i.productId === product.id ? { ...i, quantity: nextQty } : i,
          )
        : [...items, { productId: product.id, quantity: nextQty }];

    this.guestItems.set(next);
    this.writeGuestCart(next);
  }

  private guestSetQuantity(productId: string, quantity: number) {
    const items = this.guestItems();
    const next =
      quantity <= 0
        ? items.filter((i) => i.productId !== productId)
        : items.some((i) => i.productId === productId)
          ? items.map((i) => (i.productId === productId ? { ...i, quantity } : i))
          : [...items, { productId, quantity }];

    this.guestItems.set(next);
    this.writeGuestCart(next);
  }

  private readGuestCart(): GuestCartItem[] {
    try {
      const raw = localStorage.getItem(this.guestKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter(
          (x): x is GuestCartItem =>
            !!x &&
            typeof x === 'object' &&
            typeof (x as GuestCartItem).productId === 'string' &&
            typeof (x as GuestCartItem).quantity === 'number' &&
            Number.isFinite((x as GuestCartItem).quantity) &&
            (x as GuestCartItem).quantity > 0,
        )
        .slice(0, 200);
    } catch {
      return [];
    }
  }

  private writeGuestCart(items: GuestCartItem[]) {
    try {
      localStorage.setItem(this.guestKey, JSON.stringify(items));
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }
}
