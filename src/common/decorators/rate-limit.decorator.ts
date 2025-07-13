import { UseGuards } from '@nestjs/common';
import { RateLimitGuard } from '../guards/rate-limit.guard';

export function RateLimit() {
	return UseGuards(RateLimitGuard);
}
