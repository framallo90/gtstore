import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

type EmailDriver = 'log' | 'smtp';

type OrderEmailItem = {
  productName: string;
  quantity: number;
  unitPrice: unknown;
};

type OrderEmailData = {
  id: string;
  status?: string;
  subtotal?: unknown;
  discount?: unknown;
  total?: unknown;
  paymentMethod?: string | null;
  couponCode?: string | null;
  notes?: string | null;
  items: OrderEmailItem[];
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendOrderConfirmation(input: {
    to: string;
    customerName?: string;
    order: OrderEmailData;
  }) {
    const name = input.customerName?.trim() || 'hola';
    const subject = `Pedido confirmado: ${input.order.id}`;
    const text = this.renderOrderConfirmationText(name, input.order);
    const html = this.renderOrderConfirmationHtml(name, input.order);

    await this.send({
      to: input.to,
      subject,
      text,
      html,
    });
  }

  async sendOrderStatusUpdate(input: {
    to: string;
    customerName?: string;
    orderId: string;
    status: string;
  }) {
    const name = input.customerName?.trim() || 'hola';
    const statusLabel = this.formatStatus(input.status);
    const subject = `Actualizacion de pedido ${input.orderId}: ${statusLabel}`;

    const text = `Hola ${name},

Actualizamos el estado de tu pedido ${input.orderId} a: ${statusLabel}.

Gracias,
GeekyTreasures
`;

    const html = `<p>Hola <strong>${this.escapeHtml(name)}</strong>,</p>
<p>Actualizamos el estado de tu pedido <strong>${this.escapeHtml(
      input.orderId,
    )}</strong> a: <strong>${this.escapeHtml(statusLabel)}</strong>.</p>
<p>Gracias,<br/>GeekyTreasures</p>`;

    await this.send({ to: input.to, subject, text, html });
  }

  async sendMercadoPagoPaymentLink(input: {
    to: string;
    customerName?: string;
    orderId: string;
    redirectUrl: string;
  }) {
    const name = input.customerName?.trim() || 'hola';
    const subject = `Completa tu pago: ${input.orderId}`;

    const text = `Hola ${name},

Para completar tu compra, paga con Mercado Pago usando este link:
${input.redirectUrl}

Pedido: ${input.orderId}

Si ya pagaste, podes ignorar este mensaje.

Gracias,
GeekyTreasures
`;

    const html = `<p>Hola <strong>${this.escapeHtml(name)}</strong>,</p>
<p>Para completar tu compra, paga con <strong>Mercado Pago</strong> usando este link:</p>
<p><a href="${this.escapeHtml(input.redirectUrl)}">Pagar con Mercado Pago</a></p>
<p><strong>Pedido:</strong> ${this.escapeHtml(input.orderId)}</p>
<p>Si ya pagaste, podes ignorar este mensaje.</p>
<p>Gracias,<br/>GeekyTreasures</p>`;

    await this.send({ to: input.to, subject, text, html });
  }

  async sendEmailVerification(input: {
    to: string;
    customerName?: string;
    verifyUrl: string;
  }) {
    const name = input.customerName?.trim() || 'hola';
    const subject = 'Verifica tu email';

    const text = `Hola ${name},

Para verificar tu email, usa este link:
${input.verifyUrl}

Si no creaste una cuenta, ignora este mensaje.

Gracias,
GeekyTreasures
`;

    const html = `<p>Hola <strong>${this.escapeHtml(name)}</strong>,</p>
<p>Para verificar tu email, usa este link:</p>
<p><a href="${this.escapeHtml(input.verifyUrl)}">Verificar email</a></p>
<p>Si no creaste una cuenta, ignora este mensaje.</p>
<p>Gracias,<br/>GeekyTreasures</p>`;

    await this.send({ to: input.to, subject, text, html });
  }

  async sendPasswordReset(input: {
    to: string;
    customerName?: string;
    resetUrl: string;
  }) {
    const name = input.customerName?.trim() || 'hola';
    const subject = 'Restablecer password';

    const text = `Hola ${name},

Para restablecer tu password, usa este link:
${input.resetUrl}

Si no lo pediste, ignora este mensaje.

Gracias,
GeekyTreasures
`;

    const html = `<p>Hola <strong>${this.escapeHtml(name)}</strong>,</p>
<p>Para restablecer tu password, usa este link:</p>
<p><a href="${this.escapeHtml(input.resetUrl)}">Restablecer password</a></p>
<p>Si no lo pediste, ignora este mensaje.</p>
<p>Gracias,<br/>GeekyTreasures</p>`;

    await this.send({ to: input.to, subject, text, html });
  }

  private async send(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    const driver = this.getDriver();

    if (driver === 'log') {
      this.logger.log(`EMAIL(log) to=${input.to} subject="${input.subject}"`);
      return;
    }

    const from = this.config.get<string>('EMAIL_FROM');
    if (!from) {
      this.logger.error('EMAIL_FROM is required when EMAIL_DRIVER=smtp. Falling back to log.');
      this.logger.log(`EMAIL(log) to=${input.to} subject="${input.subject}"`);
      return;
    }

    const transporter = await this.getTransporter();
    if (!transporter) {
      this.logger.error('SMTP transporter is not configured. Falling back to log.');
      this.logger.log(`EMAIL(log) to=${input.to} subject="${input.subject}"`);
      return;
    }

    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }

  private getDriver(): EmailDriver {
    const raw = (this.config.get<string>('EMAIL_DRIVER') ?? 'log').toLowerCase();
    if (raw === 'smtp') {
      return 'smtp';
    }
    return 'log';
  }

  private async getTransporter(): Promise<nodemailer.Transporter | null> {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.config.get<string>('SMTP_HOST');
    const portRaw = this.config.get<string>('SMTP_PORT') ?? '';
    const secureRaw = (this.config.get<string>('SMTP_SECURE') ?? '').toLowerCase();
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    const port = portRaw ? Number(portRaw) : 0;
    const secure = secureRaw === 'true' || secureRaw === '1';

    if (!host || !port || !Number.isFinite(port)) {
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    return this.transporter;
  }

  private renderOrderConfirmationText(customerName: string, order: OrderEmailData) {
    const items = (order.items ?? [])
      .map((i) => `- ${i.productName} x${i.quantity} (${this.formatMoney(i.unitPrice)} USD)`)
      .join('\n');

    const paymentLine = order.paymentMethod
      ? `Metodo de pago: ${this.formatPaymentMethod(order.paymentMethod)}\n`
      : '';

    return `Hola ${customerName},

Gracias por tu compra en GeekyTreasures.

Pedido: ${order.id}
Total: ${this.formatMoney(order.total)} USD
${paymentLine}

Items:
${items || '- (sin items)'}

Gracias,
GeekyTreasures
`;
  }

  private renderOrderConfirmationHtml(customerName: string, order: OrderEmailData) {
    const itemsHtml = (order.items ?? [])
      .map(
        (i) =>
          `<li><strong>${this.escapeHtml(i.productName)}</strong> x${i.quantity} (${this.escapeHtml(
            this.formatMoney(i.unitPrice),
          )} USD)</li>`,
      )
      .join('');

    const paymentHtml = order.paymentMethod
      ? `<p><strong>Metodo de pago:</strong> ${this.escapeHtml(
          this.formatPaymentMethod(order.paymentMethod),
        )}</p>`
      : '';

    return `<p>Hola <strong>${this.escapeHtml(customerName)}</strong>,</p>
<p>Gracias por tu compra en <strong>GeekyTreasures</strong>.</p>
<p><strong>Pedido:</strong> ${this.escapeHtml(order.id)}<br/>
<strong>Total:</strong> ${this.escapeHtml(this.formatMoney(order.total))} USD</p>
${paymentHtml}
<p><strong>Items:</strong></p>
<ul>${itemsHtml || '<li>(sin items)</li>'}</ul>
<p>Gracias,<br/>GeekyTreasures</p>`;
  }

  private formatStatus(status: string) {
    switch (status) {
      case 'PENDING':
        return 'Pendiente';
      case 'PAID':
        return 'Pago';
      case 'PROCESSING':
        return 'En proceso';
      case 'SHIPPED':
        return 'Enviado';
      case 'DELIVERED':
        return 'Entregado';
      case 'CANCELED':
        return 'Cancelado';
      default:
        return status;
    }
  }

  private formatPaymentMethod(method: string) {
    switch (method) {
      case 'CASH':
        return 'Efectivo';
      case 'TRANSFER':
        return 'Transferencia';
      case 'MERCADOPAGO':
        return 'Mercado Pago';
      default:
        return method;
    }
  }

  private formatMoney(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return '0.00';
    }
    return n.toFixed(2);
  }

  private escapeHtml(input: string) {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
