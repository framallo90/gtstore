import {
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from './core/api.service';
import { AuthService } from './core/auth.service';
import { CartService } from './core/cart.service';
import { ToastService } from './core/toast.service';
import { AnalyticsService } from './core/analytics.service';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected title = 'storefront';

  public authService = inject(AuthService);
  public cartService = inject(CartService);
  public toastService = inject(ToastService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly analytics = inject(AnalyticsService);
  private readonly destroyRef = inject(DestroyRef);

  cartDrawerOpen = signal(false);

  @ViewChild('drawerPanel') private drawerPanel?: ElementRef<HTMLElement>;
  @ViewChild('drawerClose') private drawerClose?: ElementRef<HTMLButtonElement>;

  private lastActiveElement: HTMLElement | null = null;
  private previousBodyOverflow: string | null = null;

  ngOnInit() {
    this.cartService.init();
    // Best-effort session restore only when we have a prior session hint (avoids noisy calls for new users/tests).
    this.authService.restoreSessionFromHint().subscribe();

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.closeCartDrawer({ restoreFocus: false });
        this.analytics.pageView(e.urlAfterRedirects);
      });
  }

  openCartDrawer() {
    if (this.cartDrawerOpen()) {
      return;
    }

    this.cartService.ensureGuestProductsLoaded();
    this.lastActiveElement =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    this.cartDrawerOpen.set(true);
    this.lockScroll();
    this.bindDrawerKeydown();
    this.focusDrawer();
    this.analytics.track('mini_cart_open', { itemCount: this.cartService.itemCount() });
  }

  closeCartDrawer(opts?: { restoreFocus?: boolean }) {
    const wasOpen = this.cartDrawerOpen();
    this.cartDrawerOpen.set(false);
    this.unbindDrawerKeydown();
    this.unlockScroll();

    if (wasOpen && opts?.restoreFocus !== false) {
      this.restoreFocus();
    }
  }

  inc(productId: string, quantity: number, stock: number) {
    if (quantity >= stock) {
      return;
    }
    this.cartService.setQuantity(productId, quantity + 1);
  }

  dec(productId: string, quantity: number) {
    this.cartService.setQuantity(productId, quantity - 1);
  }

  clearCart() {
    this.cartService.clear();
    this.analytics.track('cart_clear_click', { source: 'drawer' });
  }

  logout() {
    this.api.logout().subscribe({
      next: () => {
        this.authService.logout();
        this.cartService.refreshServerCart().subscribe();
      },
      error: () => {
        this.authService.logout();
        this.cartService.refreshServerCart().subscribe();
      },
    });
  }

  private bindDrawerKeydown() {
    if (typeof document === 'undefined') {
      return;
    }
    document.addEventListener('keydown', this.onDrawerKeydown, true);
  }

  private unbindDrawerKeydown() {
    if (typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('keydown', this.onDrawerKeydown, true);
  }

  private onDrawerKeydown = (ev: KeyboardEvent) => {
    if (!this.cartDrawerOpen()) {
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.closeCartDrawer();
      return;
    }
    if (ev.key === 'Tab') {
      this.trapTab(ev);
    }
  };

  private trapTab(ev: KeyboardEvent) {
    const root = this.drawerPanel?.nativeElement;
    if (!root) {
      return;
    }

    const focusables = this.getFocusableElements(root);
    if (focusables.length === 0) {
      ev.preventDefault();
      root.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    const active =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (!active || !root.contains(active)) {
      ev.preventDefault();
      first.focus();
      return;
    }

    if (ev.shiftKey && active === first) {
      ev.preventDefault();
      last.focus();
      return;
    }

    if (!ev.shiftKey && active === last) {
      ev.preventDefault();
      first.focus();
      return;
    }
  }

  private getFocusableElements(root: HTMLElement): HTMLElement[] {
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    );
    return nodes.filter((el) => {
      if (el.hasAttribute('disabled')) {
        return false;
      }
      if (el.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      // Basic visibility check.
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    });
  }

  private focusDrawer() {
    const g = globalThis as unknown as { setTimeout?: typeof setTimeout };
    g.setTimeout?.(() => {
      const btn = this.drawerClose?.nativeElement;
      if (btn) {
        btn.focus();
        return;
      }
      this.drawerPanel?.nativeElement?.focus();
    }, 0);
  }

  private restoreFocus() {
    const el = this.lastActiveElement;
    this.lastActiveElement = null;
    if (!el) {
      return;
    }
    const g = globalThis as unknown as { setTimeout?: typeof setTimeout };
    g.setTimeout?.(() => {
      try {
        el.focus();
      } catch {
        // ignore
      }
    }, 0);
  }

  private lockScroll() {
    if (typeof document === 'undefined') {
      return;
    }
    if (this.previousBodyOverflow === null) {
      this.previousBodyOverflow = document.body.style.overflow ?? '';
    }
    document.body.style.overflow = 'hidden';
  }

  private unlockScroll() {
    if (typeof document === 'undefined') {
      return;
    }
    if (this.previousBodyOverflow === null) {
      return;
    }
    document.body.style.overflow = this.previousBodyOverflow;
    this.previousBodyOverflow = null;
  }
}
