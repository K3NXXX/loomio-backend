import { PrismaService } from '@/common/prisma/prisma.service';
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { CommentReactionDto } from './dto/comment-reaction.dto';
import { CommentDto } from './dto/comment.dto';

@Injectable()
export class CommentService {
	constructor(private readonly prisma: PrismaService) {}

	async create(userId: string, dto: CommentDto) {
		const { videoId, content, parentId } = dto;

		const video = await this.prisma.video.findUnique({ where: { id: videoId } });
		if (!video) throw new NotFoundException('Video not found');

		if (parentId) {
			const parentComment = await this.prisma.videoComment.findUnique({
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

		return comment;
	}

	// async findOne(id: string, userId: string) {
	// 	const comment = await this.prisma.comment.findUnique({
	// 		where: { id },
	// 		select: this.select(userId),
	// 	});

	// 	if (!comment) throw new NotFoundException('Comment not found');

	// 	const { likes, ...rest } = comment;

	// 	return {
	// 		...rest,
	// 		liked: !!likes.length,
	// 	};
	// }

	async findAllForPost(videoId: string, userId: string, page: number, take: number) {
		const post = await this.prisma.video.findUnique({ where: { id: videoId } });
		if (!post) throw new NotFoundException('Post not found');

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

	// async findReplies(id: string, userId: string, page: number, take: number) {
	// 	const parent = await this.prisma.comment.findUnique({
	// 		where: { id: id },
	// 	});
	// 	if (!parent) throw new NotFoundException('Parent comment not found');

	// 	const [replies, total] = await Promise.all([
	// 		this.prisma.comment.findMany({
	// 			where: { parentId: id },
	// 			orderBy: { createdAt: 'asc' },
	// 			skip: (page - 1) * take,
	// 			take,
	// 			select: this.select(userId),
	// 		}),
	// 		this.prisma.comment.count({ where: { parentId: id } }),
	// 	]);

	// 	return {
	// 		data: this.format(replies),
	// 		total,
	// 		page,
	// 		take,
	// 		totalPages: Math.ceil(total / take),
	// 	};
	// }

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
