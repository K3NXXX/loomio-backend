import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsGateway } from '../notification/notification.gateway';
import { NotificationService } from '../notification/notification.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationService: NotificationService,
		private readonly notificationsGateway: NotificationsGateway,
	) {}

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

	async getVideoReports() {
		return this.prisma.report.findMany({
			where: { videoId: { not: null } },
			orderBy: { createdAt: 'desc' },
			include: {
				author: { select: { id: true, username: true, avatarUrl: true } },
				assignedTo: { select: { id: true, username: true, avatarUrl: true } },
				video: {
					select: {
						id: true,
						title: true,
						channel: {
							select: {
								id: true,
								username: true,
								avatarUrl: true,
							},
						},
					},
				},
			},
		});
	}

	async getCommentReports() {
		return this.prisma.report.findMany({
			where: { commentId: { not: null } },
			orderBy: { createdAt: 'desc' },
			include: {
				author: { select: { id: true, username: true, avatarUrl: true } },
				assignedTo: { select: { id: true, username: true, avatarUrl: true } },
				comment: {
					select: {
						id: true,
						content: true,
						user: {
							select: { id: true, username: true, avatarUrl: true },
						},
					},
				},
			},
		});
	}

	async getCommentHistory() {
		return this.prisma.report.findMany({
			where: {
				status: 'RESOLVED',
			},
			orderBy: { createdAt: 'desc' },
			include: {
				author: { select: { id: true, username: true, avatarUrl: true } },
				assignedTo: { select: { id: true, username: true, avatarUrl: true } },
				comment: {
					select: {
						id: true,
						content: true,
						user: {
							select: { id: true, username: true, avatarUrl: true },
						},
					},
				},
			},
		});
	}

	async getVideoHistory() {
		return this.prisma.report.findMany({
			where: {
				status: 'RESOLVED',
				commentId: null,
			},
			orderBy: { createdAt: 'desc' },
			include: {
				author: {
					select: {
						id: true,
						username: true,
						avatarUrl: true,
					},
				},
				assignedTo: {
					select: {
						id: true,
						username: true,
						avatarUrl: true,
					},
				},
				video: {
					select: {
						id: true,
						title: true,
						thumbnailFile: true,
						channel: {
							select: {
								id: true,
								username: true,
								avatarUrl: true,
							},
						},
					},
				},
			},
		});
	}

	async getOne(id: string) {
		return this.prisma.report.findUnique({
			where: { id },
			include: {
				author: {
					select: {
						id: true,
						username: true,
						avatarUrl: true,
					},
				},
				comment: {
					select: {
						id: true,
						content: true,
						user: {
							select: {
								id: true,
								username: true,
								avatarUrl: true,
							},
						},
					},
				},
				video: {
					select: {
						id: true,
						title: true,
						thumbnailFile: true,
						videoFile: true,
						channel: {
							select: {
								id: true,
								username: true,
								avatarUrl: true,
							},
						},
					},
				},

				assignedTo: {
					select: {
						id: true,
						username: true,
						avatarUrl: true,
					},
				},
			},
		});
	}

	async remove(id: string) {
		await this.prisma.report.delete({ where: { id } });
		return { message: 'Report removed' };
	}

	async assign(reportId: string, moderatorId: string) {
		const report = await this.prisma.report.findUnique({
			where: { id: reportId },
			select: {
				id: true,
				assignedToId: true,
				status: true,
			},
		});

		if (!report) {
			throw new BadRequestException('Report not found');
		}

		if (report.assignedToId && report.assignedToId !== moderatorId) {
			throw new BadRequestException('Report already assigned to another moderator');
		}

		if (report.status === 'RESOLVED' || report.status === 'REJECTED') {
			throw new BadRequestException('Report already resolved');
		}

		if (report.assignedToId === moderatorId) {
			return this.prisma.report.update({
				where: { id: reportId },
				data: {
					assignedToId: null,
					status: 'PENDING',
				},
				include: {
					assignedTo: {
						select: { id: true, username: true, avatarUrl: true },
					},
				},
			});
		}

		return this.prisma.report.update({
			where: { id: reportId },
			data: {
				assignedToId: moderatorId,
				status: 'IN_PROGRESS',
			},
			include: {
				assignedTo: {
					select: { id: true, username: true, avatarUrl: true },
				},
			},
		});
	}

	async approve(reportId: string, moderatorId: string) {
		const report = await this.prisma.report.findUnique({
			where: { id: reportId },
			select: { assignedToId: true, status: true },
		});

		if (!report) throw new BadRequestException('Report not found');

		if (report.assignedToId !== moderatorId)
			throw new BadRequestException('You are not assigned to this report');

		if (report.status === 'RESOLVED' || report.status === 'REJECTED')
			throw new BadRequestException('Report already resolved');

		return this.prisma.report.update({
			where: { id: reportId },
			data: {
				status: 'RESOLVED',
			},
		});
	}

	async deleteComment(reportId: string, moderatorId: string) {
		const report = await this.prisma.report.findUnique({
			where: { id: reportId },
			select: {
				assignedToId: true,
				commentId: true,
				status: true,
				reason: true,
			},
		});

		if (!report) throw new BadRequestException('Report not found');

		if (!report.commentId) throw new BadRequestException('This report is not a comment report');

		if (report.assignedToId !== moderatorId)
			throw new BadRequestException('You are not assigned to this report');

		const originalComment = await this.prisma.videoComment.findUnique({
			where: { id: report.commentId },
			select: { userId: true, id: true },
		});

		if (!originalComment) throw new BadRequestException('Original comment not found');

		const authorId = originalComment.userId;

		await this.prisma.videoComment.delete({
			where: { id: report.commentId },
		});

		const notification = await this.notificationService.create({
			type: NotificationType.COMMENT_REMOVED,
			message: `Your comment was removed for ${report.reason.toLowerCase().replace(/_/g, ' ')}`,
			userId: authorId,
			authorId: moderatorId,
		});

		this.notificationsGateway.sendNotification(authorId, {
			id: notification.id,
			type: notification.type,
			message: notification.message,
			authorId: moderatorId,
			commentId: originalComment.id,
			createdAt: notification.createdAt,
		});

		return this.prisma.report.update({
			where: { id: reportId },
			data: {
				status: 'RESOLVED',
			},
		});
	}
}
