import { CloudinaryService } from '@/common/libs/cloudinary/cloudinary.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
	ForbiddenException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { UploadApiResponse } from 'cloudinary';
import { NotificationsGateway } from '../notification/notification.gateway';
import { NotificationService } from '../notification/notification.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

@Injectable()
export class VideosService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudinary: CloudinaryService,
		private readonly notificationService: NotificationService,
		private readonly notificationsGateway: NotificationsGateway,
	) {}

	async create(
		createVideoDto: CreateVideoDto,
		files: { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] },
		userId: string,
	) {
		const videoFile = files.file?.[0];
		const thumbnailFile = files.thumbnail?.[0];

		if (!videoFile || !thumbnailFile) {
			throw new InternalServerErrorException('Video or thumbnail file missing');
		}

		const { channelId, title, description, tags, visibility, audience, publishType, publishDate } =
			createVideoDto;

		const channel = await this.prisma.channel.findUnique({
			where: { id: channelId },
			select: { id: true, userId: true },
		});

		if (!channel) {
			throw new NotFoundException('Channel not found');
		}
		if (channel.userId !== userId) {
			throw new ForbiddenException('You are not allowed to upload to this channel');
		}

		try {
			const uploadedVideo: UploadApiResponse = await this.cloudinary.uploadFile(videoFile, {
				resource_type: 'video',
				folder: 'videos',
			});

			const uploadedThumbnail: UploadApiResponse = await this.cloudinary.uploadFile(thumbnailFile, {
				resource_type: 'image',
				folder: 'thumbnails',
			});

			const newVideo = await this.prisma.video.create({
				data: {
					title,
					description,
					tags,
					visibility,
					audience,
					publishType,
					publishDate: publishDate ? new Date(publishDate) : null,
					videoFile: uploadedVideo.secure_url,
					videoPublicId: uploadedVideo.public_id,
					thumbnailFile: uploadedThumbnail.secure_url,
					thumbnailPublicId: uploadedThumbnail.public_id,
					channelId,
				},
			});

			const followers = await this.prisma.channelFollow.findMany({
				where: {
					channelId,
					notificationsEnabled: true,
				},
				select: {
					followerId: true,
					follower: {
						select: { username: true },
					},
				},
			});

			const channelInfo = await this.prisma.channel.findUnique({
				where: { id: channelId },
				select: { name: true },
			});

			if (followers.length > 0) {
				const channelName = channelInfo?.name ?? 'Your channel';

				for (const follower of followers) {
					const notification = await this.notificationService.create({
						type: NotificationType.VIDEO_PUBLISHED,
						message: `${channelName} uploaded a new video`,
						userId: follower.followerId,
						authorId: userId,
						videoId: newVideo.id,
						channelId,
					});

					this.notificationsGateway.sendNotification(follower.followerId, {
						id: notification.id,
						type: notification.type,
						message: notification.message,
						authorId: userId,
						videoId: newVideo.id,
						channelId,
						createdAt: notification.createdAt,
					});
				}
			}

			return { message: '✅ Video successfully uploaded', data: newVideo };
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			console.error('❌ Video upload error:', errorMessage);
			throw new InternalServerErrorException(`Failed to upload video: ${errorMessage}`);
		}
	}

	async findAll() {
		return this.prisma.video.findMany({
			where: { visibility: 'public', publishType: 'now' },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				title: true,
				description: true,
				tags: true,
				thumbnailFile: true,
				videoFile: true,
				createdAt: true,
				channel: {
					select: {
						id: true,
						username: true,
						name: true,
						avatarUrl: true,
						_count: { select: { followers: true } },
					},
				},
				_count: { select: { views: true } },
			},
		});
	}

	async findOne(id: string) {
	const video = await this.prisma.video.findFirst({
		where: { id, visibility: 'public' },
		select: {
			id: true,
			title: true,
			description: true,
			videoFile: true,
			thumbnailFile: true,
			createdAt: true,
			tags: true,
			videoPublicId: true,
			likesCount: true,       
			dislikesCount: true,    
			_count: {
				select: {
					views: true,
					comments: true,
				},
			},
			channel: {
				select: {
					id: true,
					username: true,
					name: true,
					userId: true,
					avatarUrl: true,
					_count: { select: { followers: true } },
				},
			},
			comments: {
				select: {
					id: true,
					content: true,
					createdAt: true,
					user: {
						select: { id: true, username: true, avatarUrl: true },
					},
					replies: {
						select: {
							id: true,
							content: true,
							createdAt: true,
							user: { select: { id: true, username: true, avatarUrl: true } },
						},
					},
				},
			},
		},
	});

	if (!video) {
		throw new NotFoundException('Video not found or is private');
	}

	return video;
}


	async update(
		id: string,
		updateVideoDto: UpdateVideoDto,
		files: { file?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] },
		userId: string,
	) {
		const existingVideo = await this.prisma.video.findUnique({
			where: { id },
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

		if (!existingVideo) {
			throw new NotFoundException('Video not found');
		}

		if (existingVideo.channel.userId !== userId) {
			throw new ForbiddenException('You are not allowed to edit this video');
		}

		const videoFile = files.file?.[0];
		const thumbnailFile = files.thumbnail?.[0];

		let videoFileUrl: string | undefined;
		let thumbnailFileUrl: string | undefined;

		try {
			if (videoFile) {
				const uploadedVideo: UploadApiResponse = await this.cloudinary.uploadFile(videoFile, {
					resource_type: 'video',
					folder: 'videos',
				});
				videoFileUrl = uploadedVideo.secure_url;
			}

			if (thumbnailFile) {
				const uploadedThumbnail: UploadApiResponse = await this.cloudinary.uploadFile(
					thumbnailFile,
					{
						resource_type: 'image',
						folder: 'thumbnails',
					},
				);
				thumbnailFileUrl = uploadedThumbnail.secure_url;
			}

			const { title, description, tags, visibility, audience, publishType, publishDate } =
				updateVideoDto;

			const data: any = {};

			if (title !== undefined) data.title = title;
			if (description !== undefined) data.description = description;
			if (tags !== undefined) data.tags = tags;
			if (visibility !== undefined) data.visibility = visibility;
			if (audience !== undefined) data.audience = audience;
			if (publishType !== undefined) data.publishType = publishType;

			if (publishDate !== undefined) {
				data.publishDate = publishDate ? new Date(publishDate) : null;
			}

			if (videoFileUrl) data.videoFile = videoFileUrl;
			if (thumbnailFileUrl) data.thumbnailFile = thumbnailFileUrl;

			const updatedVideo = await this.prisma.video.update({
				where: { id },
				data,
			});

			return { message: '✅ Video successfully updated', data: updatedVideo };
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			console.error('❌ Video update error:', errorMessage);
			throw new InternalServerErrorException(`Failed to update video: ${errorMessage}`);
		}
	}

	async remove(id: string, userId: string) {
		const video = await this.prisma.video.findUnique({
			where: { id },
			select: {
				id: true,
				videoPublicId: true,
				thumbnailPublicId: true,
				channel: { select: { userId: true } },
			},
		});

		if (!video) throw new NotFoundException('Video not found');
		if (video.channel.userId !== userId)
			throw new ForbiddenException('You are not allowed to delete this video');

		try {
			if (video.videoPublicId) {
				await this.cloudinary.deleteFile(video.videoPublicId, 'video');
			}
			if (video.thumbnailPublicId) {
				await this.cloudinary.deleteFile(video.thumbnailPublicId, 'image');
			}

			await this.prisma.video.delete({ where: { id } });

			return { message: '🗑️ Video successfully deleted' };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new InternalServerErrorException(`Failed to delete video: ${message}`);
		}
	}

	async getRecommended(videoId: string) {
		const current = await this.prisma.video.findUnique({
			where: { id: videoId },
			select: { id: true, tags: true, channelId: true },
		});

		if (!current) return [];

		const tags = current.tags ? current.tags.split(/[\s,]+/).filter(Boolean) : [];

		return this.prisma.video.findMany({
			where: {
				publishType: 'now',
				visibility: 'public',
				AND: [
					{ id: { not: current.id } },
					{
						OR: [
							{ channelId: current.channelId },
							...tags.map((t) => ({
								tags: { contains: t, mode: Prisma.QueryMode.insensitive },
							})),
						],
					},
				],
			},
			select: {
				id: true,
				title: true,
				thumbnailFile: true,
				createdAt: true,
				_count: { select: { views: true } },
				channel: {
					select: { name: true },
				},
			},
			orderBy: [{ createdAt: 'desc' }],
			take: 10,
		});
	}

	async addToUserPlaylist(userId: string, videoId: string, playlistId: string) {
		const video = await this.prisma.video.findUnique({ where: { id: videoId } });
		if (!video) throw new NotFoundException('Video not found');

		const playlist = await this.prisma.playlist.findUnique({
			where: { id: playlistId },
		});
		if (!playlist || playlist.userId !== userId) throw new ForbiddenException('Not allowed');

		return this.prisma.video.update({
			where: { id: videoId },
			data: {
				playlists: {
					connect: { id: playlistId },
				},
			},
			select: {
				id: true,
				title: true,
				playlists: {
					select: { id: true, name: true },
				},
			},
		});
	}

	async removeFromUserPlaylist(userId: string, videoId: string, playlistId: string) {
		const video = await this.prisma.video.findUnique({ where: { id: videoId } });
		if (!video) throw new NotFoundException('Video not found');

		const playlist = await this.prisma.playlist.findUnique({
			where: { id: playlistId },
		});
		if (!playlist || playlist.userId !== userId) throw new ForbiddenException('Not allowed');

		return this.prisma.video.update({
			where: { id: videoId },
			data: {
				playlists: {
					disconnect: { id: playlistId },
				},
			},
			select: {
				id: true,
				title: true,
				playlists: {
					select: { id: true, name: true },
				},
			},
		});
	}

	async findAllForChannelStudio(channelId: string) {
		return this.prisma.video.findMany({
			where: { channelId },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				title: true,
				description: true,
				tags: true,
				thumbnailFile: true,
				videoFile: true,
				visibility: true,
				audience: true,
				publishType: true,
				publishDate: true,
				createdAt: true,
				_count: { select: { views: true, likes: true, comments: true } },
			},
		});
	}
}
