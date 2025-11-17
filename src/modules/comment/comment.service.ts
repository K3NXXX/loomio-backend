import { PrismaService } from '@/common/prisma/prisma.service';
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { NotificationsGateway } from '../notification/notification.gateway';
import { NotificationService } from '../notification/notification.service';
import { CommentReactionDto } from './dto/comment-reaction.dto';
import { CommentDto } from './dto/comment.dto';

@Injectable()
export class CommentService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly notificationService: NotificationService,
		private readonly notificationsGateway: NotificationsGateway,
	) {}

	async create(userId: string, dto: CommentDto) {
		const { videoId, content, parentId } = dto;

		const video = await this.prisma.video.findUnique({
			where: { id: videoId },
			select: {
				id: true,
				channel: {
					select: {
						id: true,
						userId: true,
					},
				},
			},
		});

		if (!video) throw new NotFoundException('Video not found');

		let parentComment: { userId: string; videoId: string } | null = null;

		if (parentId) {
			parentComment = await this.prisma.videoComment.findUnique({
				where: { id: parentId },
			});

			if (!parentComment || parentComment.videoId !== videoId) {
				throw new BadRequestException('Invalid parent comment');
			}
		}

		const comment = await this.prisma.videoComment.create({
			data: {
				content,
				videoId,
				userId,
				parentId,
			},
			include: {
				user: {
					select: {
						id: true,
						username: true,
						name: true,
						avatarUrl: true,
					},
				},
			},
		});

		if (!parentId) {
			const targetUserId = video.channel.userId;

			if (targetUserId !== userId) {
				const author = await this.prisma.user.findUnique({
					where: { id: userId },
					select: { username: true },
				});

				const username = author?.username ?? 'Someone';

				const notification = await this.notificationService.create({
					type: NotificationType.COMMENT_NEW,
					message: `${username} commented on your video`,
					userId: targetUserId,
					authorId: userId,
					videoId,
					channelId: video.channel.id,
				});

				this.notificationsGateway.sendNotification(targetUserId, {
					id: notification.id,
					type: notification.type,
					message: notification.message,
					createdAt: notification.createdAt,
					authorId: userId,
					videoId,
					channelId: video.channel.id,
				});
			}

			return comment;
		}

		const targetUserId = parentComment!.userId;

		if (targetUserId !== userId) {
			const author = await this.prisma.user.findUnique({
				where: { id: userId },
				select: { username: true },
			});

			const username = author?.username ?? 'Someone';

			const notification = await this.notificationService.create({
				type: NotificationType.COMMENT_REPLY,
				message: `${username} replied to your comment`,
				userId: targetUserId,
				authorId: userId,
				videoId,
				channelId: video.channel.id,
			});

			this.notificationsGateway.sendNotification(targetUserId, {
				id: notification.id,
				type: notification.type,
				message: notification.message,
				createdAt: notification.createdAt,
				authorId: userId,
				videoId,
				channelId: video.channel.id,
			});
		}

		return comment;
	}

	async findAllForVideo(videoId: string, userId: string, page: number, take: number) {
		const video = await this.prisma.video.findUnique({ where: { id: videoId } });
		if (!video) throw new NotFoundException('Post not found');

		const [comments, total] = await Promise.all([
			this.prisma.videoComment.findMany({
				where: { videoId },
				orderBy: { createdAt: 'desc' },
				skip: (page - 1) * take,
				take,
				select: this.select(),
			}),
			this.prisma.videoComment.count({ where: { videoId } }),
		]);

		return {
			data: this.format(comments, userId),
			total,
			page,
			take,
			totalPages: Math.ceil(total / take),
		};
	}

	async update(id: string, userId: string, content: string) {
		const comment = await this.prisma.videoComment.findUnique({ where: { id } });

		if (!comment) throw new NotFoundException('Comment not found');
		if (comment.userId !== userId)
			throw new ForbiddenException('You can only edit your own comments');

		return this.prisma.videoComment.update({
			where: { id },
			data: { content },
		});
	}

	async remove(id: string, userId: string) {
		const comment = await this.prisma.videoComment.findUnique({
			where: { id },
			include: { replies: true },
		});

		if (!comment) throw new NotFoundException('Comment not found');
		if (comment.userId !== userId)
			throw new ForbiddenException('You can only delete your own comments');

		await this.prisma.videoComment.deleteMany({
			where: { parentId: comment.id },
		});

		await this.prisma.videoComment.delete({ where: { id: comment.id } });

		return { message: 'Comment deleted successfully' };
	}

	async reactToComment(userId: string, commentId: string, dto: CommentReactionDto) {
		const { type } = dto;

		const comment = await this.prisma.videoComment.findUnique({ where: { id: commentId } });
		if (!comment) throw new NotFoundException('Comment not found');

		const existingReaction = await this.prisma.videoCommentReaction.findUnique({
			where: { userId_commentId: { userId, commentId } },
		});

		if (existingReaction) {
			if (existingReaction.type === type) {
				await this.prisma.videoCommentReaction.delete({
					where: { id: existingReaction.id },
				});
				return { message: 'Reaction removed' };
			} else {
				await this.prisma.videoCommentReaction.update({
					where: { id: existingReaction.id },
					data: { type },
				});
				return { message: 'Reaction updated' };
			}
		}

		await this.prisma.videoCommentReaction.create({
			data: { userId, commentId, type },
		});

		return { message: 'Reaction added' };
	}

	private select() {
		return {
			id: true,
			content: true,
			parentId: true,
			createdAt: true,
			updatedAt: true,
			user: {
				select: {
					id: true,
					name: true,
					username: true,
					avatarUrl: true,
				},
			},
			parent: {
				select: {
					id: true,
					user: {
						select: {
							username: true,
						},
					},
				},
			},
			reactions: {
				select: {
					type: true,
					userId: true,
				},
			},
			_count: {
				select: {
					replies: true, // 👈 залишаємо тільки кількість, щоб показувати “2 replies”
				},
			},
		};
	}

	private format(comments: any[], currentUserId?: string) {
		return comments.map(({ reactions, ...rest }) => {
			const likes = reactions.filter((r) => r.type === 'LIKE').length;
			const dislikes = reactions.filter((r) => r.type === 'DISLIKE').length;
			const userReaction = reactions.find((r) => r.userId === currentUserId)?.type ?? null;

			return {
				...rest,
				likes,
				dislikes,
				userReaction,
			};
		});
	}
}
