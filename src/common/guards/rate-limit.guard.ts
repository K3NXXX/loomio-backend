import {
	CanActivate,
	ExecutionContext,
	HttpException,
	HttpStatus,
	Injectable,
	mixin,
	Type,
} from '@nestjs/common';
import type { Request } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';

export function RateLimitGuard(points: number, duration: number): Type<CanActivate> {
	@Injectable()
	class MixinRateLimitGuard implements CanActivate {
		private rateLimiter = new RateLimiterMemory({ points, duration });

		async canActivate(context: ExecutionContext): Promise<boolean> {
			const request = context.switchToHttp().getRequest<Request>();
			const ip: string = request.ip ?? 'unknown';

			try {
				await this.rateLimiter.consume(ip);
				return true;
			} catch {
				throw new HttpException(
					'Too many requests. Please try again later.',
					HttpStatus.TOO_MANY_REQUESTS,
				);
			}
		}
	}

	return mixin(MixinRateLimitGuard);
}
