import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreateViewDto } from './dto/create-view.dto';

@Injectable()
export class ViewService {
	constructor(private readonly prisma: PrismaService) {}

	private readonly VIEW_TIMEOUT_HOURS = 12;

	async addView(videoId: string, userId?: string | null, dto?: CreateViewDto) {
		const { ip, userAgent } = dto ?? {};

		const since = new Date(Date.now() - this.VIEW_TIMEOUT_HOURS * 60 * 60 * 1000);

		const existingView = await this.prisma.videoView.findFirst({
			where: {
				videoId,
				OR: [userId ? { userId } : {}, !userId && ip ? { ip: ip } : {}],
				createdAt: { gte: since },
			},
		});

		if (existingView) {
			return { added: false, reason: 'recently_viewed' };
		}

		await this.prisma.videoView.create({
			data: {
				videoId,
				userId,
				ip,
				userAgent,
			},
		});

		return { added: true };
	}
}
