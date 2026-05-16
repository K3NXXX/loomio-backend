import { PrismaService } from '@/common/prisma/prisma.service';
import { UserService } from '@/modules/user/user.service';
import { Injectable, Logger } from '@nestjs/common';
import Stripe = require('stripe');

@Injectable()
export class PaymentsService {
	private readonly logger = new Logger(PaymentsService.name);
	private readonly stripe: InstanceType<typeof Stripe>;

	constructor(
		private readonly prisma: PrismaService,
		private readonly userService: UserService,
	) {
		this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
	}

	async createCheckoutSession(userId: string) {
		const session = await this.stripe.checkout.sessions.create({
			mode: 'subscription',
			payment_method_types: ['card'],
			line_items: [
				{
					price: process.env.STRIPE_PRICE_ID!,
					quantity: 1,
				},
			],
			success_url: `${process.env.FRONTEND_URL}/account/premium/success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${process.env.FRONTEND_URL}/account/premium`,
			metadata: { userId },
			subscription_data: {
				metadata: { userId },
			},
		});

		return { url: session.url };
	}

	async handleWebhook(rawBody: Buffer, signature: string) {
		const event = this.stripe.webhooks.constructEvent(
			rawBody,
			signature,
			process.env.STRIPE_WEBHOOK_SECRET!,
		);

		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as {
					metadata?: Record<string, string> | null;
					payment_status?: string | null;
					mode?: string | null;
				};
				if (session.mode !== 'subscription' || session.payment_status !== 'paid') {
					break;
				}
				const userId = session.metadata?.userId;
				if (userId) {
					await this.prisma.user.update({
						where: { id: userId },
						data: { isPremium: true },
					});
				}
				break;
			}
			case 'customer.subscription.updated': {
				const sub = event.data.object as {
					id: string;
					status?: string;
					metadata?: Record<string, string> | null;
				};
				const terminal = new Set(['canceled', 'unpaid', 'incomplete_expired']);
				if (sub.status && terminal.has(sub.status)) {
					const userId = sub.metadata?.userId;
					if (userId) {
						await this.userService.revokePremium(userId);
					} else {
						this.logger.warn(`subscription.updated (${sub.status}) without userId metadata (${sub.id})`);
					}
				}
				break;
			}
			case 'customer.subscription.deleted': {
				const sub = event.data.object as { id: string; metadata?: Record<string, string> | null };
				const userId = sub.metadata?.userId;
				if (userId) {
					await this.userService.revokePremium(userId);
				} else {
					this.logger.warn(`subscription.deleted without userId metadata (${sub.id})`);
				}
				break;
			}
			case 'charge.refunded': {
				const charge = event.data.object as {
					id: string;
					amount: number;
					amount_refunded: number;
					payment_intent: string | { id?: string } | null;
				};
				if (charge.amount_refunded < charge.amount) {
					break;
				}
				const userId = await this.resolveUserIdFromCharge(charge);
				if (userId) {
					await this.userService.revokePremium(userId);
				} else {
					this.logger.warn(`charge.refunded: could not resolve userId (${charge.id})`);
				}
				break;
			}
			default:
				break;
		}
	}

	private async resolveUserIdFromCharge(charge: {
		payment_intent: string | { id?: string } | null;
	}): Promise<string | null> {
		const piId =
			typeof charge.payment_intent === 'string'
				? charge.payment_intent
				: charge.payment_intent?.id;
		if (!piId) return null;
		const intent = await this.stripe.paymentIntents.retrieve(piId);
		return intent.metadata?.userId ?? null;
	}
}
