import { Injectable, signal } from '@angular/core';

export type ToastAction = { label: string; href: string };
export type ToastVariant = 'info' | 'success' | 'error';

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  actions: ToastAction[];
  thumbnailUrl?: string;
  thumbnailAlt?: string;
  timeoutMs: number;
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);

  show(input: {
    message: string;
    variant?: ToastVariant;
    actions?: ToastAction[];
    thumbnailUrl?: string;
    thumbnailAlt?: string;
    timeoutMs?: number;
  }) {
    const toast: Toast = {
      id: this.newId(),
      message: input.message,
      variant: input.variant ?? 'info',
      actions: input.actions ?? [],
      thumbnailUrl: input.thumbnailUrl,
      thumbnailAlt: input.thumbnailAlt,
      timeoutMs: input.timeoutMs ?? 4200,
    };

    this.toasts.update((t) => [toast, ...t].slice(0, 3));

    const t = globalThis as unknown as { setTimeout?: typeof setTimeout };
    t.setTimeout?.(() => this.dismiss(toast.id), toast.timeoutMs);
  }

  dismiss(id: string) {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }

  clear() {
    this.toasts.set([]);
  }

  private newId(): string {
    const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
    if (g.crypto?.randomUUID) {
      return g.crypto.randomUUID();
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }
}
