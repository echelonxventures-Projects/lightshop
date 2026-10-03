import { Money, newId } from '@lightshop/domain-kernel';
import { CreatePaymentInput, PaymentIntent, PaymentProvider } from './payment-provider';

/**
 * Zero-dependency provider for offline methods: cash on delivery, bank transfer, cheque, B2B
 * invoice. Lets any tenant take orders on day one before signing with a PSP.
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly id = 'manual';
  readonly supportedMethods = ['cod', 'bank_transfer', 'invoice'];
  private readonly intents = new Map<string, PaymentIntent>();
  private readonly byIdempotencyKey = new Map<string, string>();

  async createIntent(input: CreatePaymentInput): Promise<PaymentIntent> {
    const existing = this.byIdempotencyKey.get(input.idempotencyKey);
    if (existing) return this.intents.get(existing)!;
    if (!this.supportedMethods.includes(input.method)) {
      throw new Error(`manual provider does not support method "${input.method}"`);
    }
    const intent: PaymentIntent = {
      id: newId('pi'),
      providerRef: `manual:${input.orderId}`,
      status: 'pending_offline',
      amount: input.amount,
      nextAction:
        input.method === 'bank_transfer'
          ? { type: 'instructions', value: `Reference ${input.orderId} on your transfer.` }
          : undefined,
    };
    this.intents.set(intent.id, intent);
    this.byIdempotencyKey.set(input.idempotencyKey, intent.id);
    return intent;
  }

  async capture(intentId: string, amount?: Money): Promise<PaymentIntent> {
    const intent = this.require(intentId);
    const captured = { ...intent, status: 'captured' as const, amount: amount ?? intent.amount };
    this.intents.set(intentId, captured);
    return captured;
  }

  async refund(intentId: string, amount: Money, _idempotencyKey: string): Promise<PaymentIntent> {
    const intent = this.require(intentId);
    if (intent.status !== 'captured') throw new Error('Only captured payments can be refunded');
    if (amount.compare(intent.amount) > 0) throw new Error('Refund exceeds captured amount');
    const refunded = { ...intent, status: 'refunded' as const };
    this.intents.set(intentId, refunded);
    return refunded;
  }

  private require(id: string): PaymentIntent {
    const intent = this.intents.get(id);
    if (!intent) throw new Error(`Unknown payment intent ${id}`);
    return intent;
  }
}
