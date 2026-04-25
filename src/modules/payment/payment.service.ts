import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import * as Stripe from 'stripe';

@Injectable()
export class PaymentsService {
	private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

	constructor(private readonly prisma: PrismaService) {}

	async createCheckoutSession(userId: string) {
		const session = await this.stripe.checkout.sessions.create({
			mode: 'payment',
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
		});

		return { url: session.url };
	}

	async handleWebhook(rawBody: Buffer, signature: string) {
		const event = this.stripe.webhooks.constructEvent(
			rawBody,
			signature,
			process.env.STRIPE_WEBHOOK_SECRET!,
		);

		if (event.type === 'checkout.session.completed') {
			const session = event.data.object;
			const userId = session.metadata?.userId;
			if (userId) {
				await this.prisma.user.update({
					where: { id: userId },
					data: { isPremium: true },
				});
			}
		}
	}
}
