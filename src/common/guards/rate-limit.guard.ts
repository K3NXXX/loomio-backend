import {
	CanActivate,
	ExecutionContext,
	HttpException,
	HttpStatus,
	Injectable,
	mixin,
	Type,
} from '@nestjs/common';
import { RateLimiterMemory } from 'rate-limiter-flexible';

export function RateLimitGuard(points: number, duration: number): Type<CanActivate> {
	@Injectable()
	class MixinRateLimitGuard implements CanActivate {
		private rateLimiter = new RateLimiterMemory({ points, duration });

		async canActivate(context: ExecutionContext): Promise<boolean> {
			const request = context.switchToHttp().getRequest();
			const ip = request.ip;

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
