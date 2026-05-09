import { OptionalCurrentUser } from '@/common/decorators/optional-user.decorator';
import { JwtOptionalGuard } from '@/common/guards/jwt-optional.guard'; // створений як м'який гард
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CreateViewDto } from './dto/create-view.dto';
import { ViewService } from './view.service';

@Controller('views')
export class ViewController {
	constructor(private readonly viewService: ViewService) {}

	@Post(':videoId')
	@UseGuards(JwtOptionalGuard)
	addView(
		@Param('videoId') videoId: string,
		@OptionalCurrentUser('id') userId: string | undefined,
		@Body() dto: CreateViewDto,
		@Req() req: Request,
	) {
		const forwarded = (req.headers['x-forwarded-for'] as string) || '';
		const resolvedIp =
			dto?.ip ?? (forwarded.split(',')[0] || req.ip || req.socket?.remoteAddress || '').trim();

		const resolvedUserAgent = dto?.userAgent ?? (req.headers['user-agent'] as string) ?? '';

		return this.viewService.addView(videoId, userId ?? null, {
			ip: resolvedIp,
			userAgent: resolvedUserAgent,
		});
	}
}
