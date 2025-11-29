import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportService {
	constructor(private readonly prisma: PrismaService) {}

	async create(authorId: string, dto: CreateReportDto) {
		const { reason, message, videoId, commentId } = dto;

		if (!videoId && !commentId) {
			throw new BadRequestException('Either videoId or commentId is required.');
		}

		const existingReport = await this.prisma.report.findFirst({
			where: {
				authorId,
				videoId: videoId ?? undefined,
				commentId: commentId ?? undefined,
			},
		});

		if (existingReport) {
			throw new BadRequestException('You have already reported this item.');
		}

		return this.prisma.report.create({
			data: {
				reason,
				message: reason === 'OTHER' ? message : null,
				authorId,
				videoId,
				commentId,
			},
		});
	}

	getAll() {
		return this.prisma.report.findMany({
			orderBy: { createdAt: 'desc' },
			include: {
				author: { select: { id: true, username: true, avatarUrl: true } },
				video: { select: { id: true, title: true } },
				comment: { select: { id: true, content: true } },
			},
		});
	}

	async remove(id: string) {
		await this.prisma.report.delete({ where: { id } });
		return { message: 'Report removed' };
	}
}
