import { CloudinaryService } from '@/common/libs/cloudinary/cloudinary.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Audience, NotificationType, ReportReason } from '@prisma/client';
import { NotificationsGateway } from '../notification/notification.gateway';
import { NotificationService } from '../notification/notification.service';
import { CreateReportDto } from './dto/create-report.dto';
import { RequestReviewDto } from './dto/request-review.dto';
import { RestrictVideoDto } from './dto/restrict-video.dto';

@Injectable()
export class ReportService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationService: NotificationService,
		private readonly notificationsGateway: NotificationsGateway,
		private readonly cloudinary: CloudinaryService,
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
				videoId: null,
			},
			orderBy: { createdAt: 'desc' },

			include: {
				author: { select: { id: true, username: true, avatarUrl: true } },
				assignedTo: { select: { id: true, username: true, avatarUrl: true } },

				comment: {
					select: {
						id: true,
						content: true,
						user: { select: { id: true, username: true, avatarUrl: true } },
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
				videoId: { not: null },
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
						restrictionModeratorReason: true,
						restrictionModeratorNote: true,
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

	private buildVideoRestrictedNotificationMessage(
		reason: ReportReason,
		moderatorNote?: string | null,
	): string {
		const sep = '\n---\n';
		const code = reason;
		const trimmed = moderatorNote?.trim();
		if (!trimmed) return code;
		let body = `${code}${sep}${trimmed}`;
		const max = 500;
		if (body.length <= max) return body;
		const maxNote = max - code.length - sep.length;
		return `${code}${sep}${trimmed.slice(0, Math.max(0, maxNote))}`;
	}

	async reportVideo(reportId: string, moderatorId: string, dto: RestrictVideoDto) {
		const report = await this.prisma.report.findUnique({
			where: { id: reportId },
			select: {
				videoId: true,
				assignedToId: true,
				status: true,
				video: {
					select: {
						id: true,
						title: true,
						channel: {
							select: {
								id: true,
								userId: true,
								username: true,
								avatarUrl: true,
							},
						},
					},
				},
			},
		});

		if (!report) throw new BadRequestException('Report not found');
		if (!report.videoId) throw new BadRequestException('This is not a video report');
		if (report.assignedToId !== moderatorId) throw new BadRequestException('You are not assigned');
		if (report.status === 'RESOLVED' || report.status === 'REJECTED')
			throw new BadRequestException('Report already resolved');

		await this.prisma.video.update({
			where: { id: report.videoId },
			data: {
				visibility: 'restricted',
				restrictionModeratorReason: dto.reason,
				restrictionModeratorNote: dto.moderatorNote?.trim() || null,
			},
		});

		if (!report.video?.channel?.userId) throw new BadRequestException('Video owner not found');

		const notificationMessage = this.buildVideoRestrictedNotificationMessage(
			dto.reason,
			dto.moderatorNote,
		);

		const notification = await this.notificationService.create({
			type: NotificationType.VIDEO_RESTRICTED,
			message: notificationMessage,
			userId: report.video.channel.userId,
			authorId: moderatorId,
			channelId: report.video.channel.id,
			videoId: report.videoId,
		});

		this.notificationsGateway.sendNotification(report.video.channel.userId, {
			id: notification.id,
			type: notification.type,
			message: notification.message,
			authorId: moderatorId,
			videoId: report.videoId,
			createdAt: notification.createdAt,
			channelId: report.video.channel.id,
		});

		return this.prisma.report.update({
			where: { id: reportId },
			data: {
				status: 'RESOLVED',
				moderatorRestrictionReason: dto.reason,
				moderatorNote: dto.moderatorNote?.trim() || null,
			},
		});
	}

	async requestReviewUpload(
		videoId: string,
		dto: RequestReviewDto,
		files: { video?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] },
		userId: string,
	) {
		const video = await this.prisma.video.findUnique({
			where: { id: videoId },
			select: {
				visibility: true,
				channelId: true,
				videoFile: true,
				thumbnailFile: true,
				channel: { select: { userId: true } },
			},
		});

		if (!video) throw new BadRequestException('Video not found');
		if (video.channel.userId !== userId) throw new BadRequestException('Not your video');
		if (video.visibility !== 'restricted')
			throw new BadRequestException('Video is not restricted — submit review only while restricted');

		const cfUid = dto.videoPublicId?.trim();
		const newVideoFile = files.video?.[0];

		if (!cfUid && !newVideoFile) {
			throw new BadRequestException('New video file or videoPublicId required');
		}

		let videoFileUrl: string;

		if (cfUid) {
			videoFileUrl = `https://videodelivery.net/${cfUid}/manifest/video.m3u8`;
		} else {
			const uploadedVideo = await this.cloudinary.uploadFile(newVideoFile!, {
				resource_type: 'video',
				folder: 'videos/review',
			});
			videoFileUrl = uploadedVideo.secure_url;
		}

		let newThumbnailUrl = video.thumbnailFile;
		if (files.thumbnail?.[0]) {
			const uploadedThumb = await this.cloudinary.uploadFile(files.thumbnail[0], {
				resource_type: 'image',
				folder: 'thumbnails/review',
			});
			newThumbnailUrl = uploadedThumb.secure_url;
		}

		const updated = await this.prisma.video.update({
			where: { id: videoId },
			data: {
				title: dto.title,
				description: dto.description,
				tags: dto.tags,
				audience: dto.audience as Audience,
				videoFile: videoFileUrl,
				videoPublicId: cfUid ?? null,
				thumbnailFile: newThumbnailUrl,
				visibility: 'pending_review',
				publishDate: null,
			},
		});

		const report = await this.prisma.report.create({
			data: {
				videoId,
				authorId: userId,
				status: 'IN_REVIEW',
				reason: ReportReason.OTHER,
			},
		});

		return { message: 'Review request submitted', updated, report };
	}

	async getStats() {
		const grouped = await this.prisma.report.groupBy({
			by: ['assignedToId'],
			where: { status: 'IN_PROGRESS', assignedToId: { not: null } },
			_count: { id: true },
		});

		const moderatorsWorking = await Promise.all(
			grouped.map(async (mod) => {
				const user = await this.prisma.user.findUnique({
					where: { id: mod.assignedToId! },
					select: { id: true, username: true, avatarUrl: true },
				});

				return {
					count: mod._count.id,
					user,
				};
			}),
		);

		return {
			total: await this.prisma.report.count(),
			pending: await this.prisma.report.count({ where: { status: 'PENDING' } }),
			inProgress: await this.prisma.report.count({ where: { status: 'IN_PROGRESS' } }),
			resolved: await this.prisma.report.count({ where: { status: 'RESOLVED' } }),
			rejected: await this.prisma.report.count({ where: { status: 'REJECTED' } }),

			videoReports: await this.prisma.report.count({ where: { videoId: { not: null } } }),
			commentReports: await this.prisma.report.count({ where: { commentId: { not: null } } }),

			moderatorsWorking, // ← тепер містить avatar, username, count

			activeAssignments: await this.prisma.report.findMany({
				where: { status: 'IN_PROGRESS' },
				select: {
					id: true,
					reason: true,
					videoId: true,
					commentId: true,
					assignedTo: {
						select: { id: true, username: true, avatarUrl: true },
					},
				},
			}),

			topReporters: await this.prisma.report.groupBy({
				by: ['authorId'],
				_count: { id: true },
				orderBy: { _count: { id: 'desc' } },
				take: 10,
			}),
		};
	}

	async confirmReviewVideo(reportId: string, moderatorId: string) {
		const report = await this.prisma.report.findUnique({
			where: { id: reportId },
			select: {
				videoId: true,
				status: true,
				assignedToId: true,
				video: {
					select: {
						id: true,
						channel: { select: { userId: true, id: true, username: true } },
					},
				},
			},
		});

		if (!report) throw new BadRequestException('Report not found');
		if (!report.videoId) throw new BadRequestException('This is not a video review report');
		if (report.assignedToId !== moderatorId)
			throw new BadRequestException('You are not assigned to this report');
		if (report.status !== 'IN_REVIEW' && report.status !== 'IN_PROGRESS')
			throw new BadRequestException('This report is not waiting for approval');

		if (!report.video) throw new BadRequestException('Video not found');
		if (!report.video.channel) throw new BadRequestException('Video owner not found');

		await this.prisma.video.update({
			where: { id: report.videoId },
			data: {
				visibility: 'public',
				restrictionModeratorReason: null,
				restrictionModeratorNote: null,
			},
		});

		const notification = await this.notificationService.create({
			type: NotificationType.VIDEO_APPROVED,
			message: 'Your video has been approved and is now public',
			userId: report.video.channel.userId,
			authorId: moderatorId,
			videoId: report.video.id,
			channelId: report.video.channel.id,
		});

		this.notificationsGateway.sendNotification(report.video.channel.userId, {
			id: notification.id,
			type: notification.type,
			message: notification.message,
			authorId: moderatorId,
			videoId: report.video.id,
			channelId: report.video.channel.id,
			createdAt: notification.createdAt,
		});

		return this.prisma.report.update({
			where: { id: reportId },
			data: { status: 'RESOLVED' },
		});
	}
}
