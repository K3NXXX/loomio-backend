import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class VideoScheduler {
	private readonly logger = new Logger(VideoScheduler.name);

	constructor(private prisma: PrismaService) {}

	@Cron(CronExpression.EVERY_MINUTE)
	async publishScheduledVideos() {
		const now = new Date();

		await this.prisma.video.updateMany({
			where: {
				publishType: 'scheduled',
				publishDate: { lte: now },
			},
			data: { publishType: 'now' },
		});
	}
}
