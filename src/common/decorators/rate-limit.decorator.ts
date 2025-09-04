import { UseGuards } from '@nestjs/common';

import { RateLimitGuard } from '../guards/rate-limit.guard';

export function RateLimit(points: number, duration: number) {
	return UseGuards(RateLimitGuard(points, duration));
}
