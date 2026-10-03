import { Money } from '@lightshop/domain-kernel';

export type PaymentStatus = 'requires_action' | 'authorized' | 'captured' | 'failed' | 'refunded' | 'pending_offline';

export interface PaymentIntent {
  id: string;
  providerRef: string;
  status: PaymentStatus;
  amount: Money;
  /** e.g. redirect URL, UPI deep link, bank transfer instructions. */
  nextAction?: { type: 'redirect' | 'instructions' | 'qr'; value: string };
}

export interface CreatePaymentInput {
  tenantId: string;
  orderId: string;
  amount: Money;
  method: string;
  idempotencyKey: string;
  customer?: { email?: string; phone?: string };
}

/**
 * Port every PSP adapter implements (Stripe, Adyen, Razorpay, PayPal, Mollie, BTCPay, …).
 * Orchestration (routing, retries, failover) lives above this, in the payments service.
 */
export interface PaymentProvider {
  readonly id: string;
  readonly supportedMethods: string[];
  createIntent(input: CreatePaymentInput): Promise<PaymentIntent>;
  capture(intentId: string, amount?: Money): Promise<PaymentIntent>;
  refund(intentId: string, amount: Money, idempotencyKey: string): Promise<PaymentIntent>;
}
