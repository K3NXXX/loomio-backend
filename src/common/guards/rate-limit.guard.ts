import {
	CanActivate,
	ExecutionContext,
	HttpException,
	HttpStatus,
	Injectable,
} from '@nestjs/common';
import { RateLimiterMemory } from 'rate-limiter-flexible';

@Injectable()
export class RateLimitGuard implements CanActivate {
	private rateLimiter = new RateLimiterMemory({
		points: 5,
		duration: 60,
	});

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
