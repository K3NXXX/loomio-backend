import { CloudinaryService } from '@/common/libs/cloudinary/cloudinary.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { UploadApiResponse } from 'cloudinary';
import { CreateVideoDto } from './dto/create-video.dto';

@Injectable()
export class VideosService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudinary: CloudinaryService,
	) {}

	async create(
		createVideoDto: CreateVideoDto,
		files: {
			file?: Express.Multer.File[];
			thumbnail?: Express.Multer.File[];
		},
		userId: string,
	) {
		const videoFile = files.file?.[0];
		const thumbnailFile = files.thumbnail?.[0];

		if (!videoFile || !thumbnailFile) {
			throw new InternalServerErrorException('Video or thumbnail file missing');
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
					title: createVideoDto.title,
					description: createVideoDto.description,
					tags: createVideoDto.tags,
					visibility: createVideoDto.visibility,
					audience: createVideoDto.audience,
					publishType: createVideoDto.publishType,
					publishDate: createVideoDto.publishDate ? new Date(createVideoDto.publishDate) : null,

					videoFile: uploadedVideo.secure_url,
					thumbnailFile: uploadedThumbnail.secure_url,

					userId,
				},
			});

			return {
				message: '✅ Video successfully uploaded',
				data: newVideo,
			};
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			console.error('❌ Video upload error:', errorMessage);

			throw new InternalServerErrorException(`Failed to upload video: ${errorMessage}`);
		}
	}

	async findAll() {
		return this.prisma.video.findMany({
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				title: true,
				description: true,
				tags: true,
				thumbnailFile: true,
				videoFile: true,
				createdAt: true,
				user: {
					select: {
						id: true,
						username: true,
						name: true,
						avatarUrl: true,
					},
				},
				_count: {
					select: {
						views: true
					},
				},
			},
		});
	}

	async findOne(id: string) {
		const video = await this.prisma.video.findFirst({
			where: {
				id: id,
				visibility: 'public',
			},
			select: {
				id: true,
				title: true,
				description: true,
				videoFile: true,
				thumbnailFile: true,
				createdAt: true,
				tags: true,

				_count: {
					select: {
						likes: true,
						views: true,
						comments: true,
					},
				},

				user: {
					select: {
						id: true,
						username: true,
						name: true,
						avatarUrl: true,
						_count: {
							select: {
								followers: true,
							},
						},
					},
				},

				comments: {
					select: {
						id: true,
						content: true,
						createdAt: true,
						user: {
							select: {
								id: true,
								username: true,
								avatarUrl: true,
							},
						},
						replies: {
							select: {
								id: true,
								content: true,
								createdAt: true,
								user: {
									select: {
										id: true,
										username: true,
										avatarUrl: true,
									},
								},
							},
						},
					},
				},
			},
		});

		if (!video) {
			throw new NotFoundException('Video not found or is private');
		}

		const likes = await this.prisma.videoLike.count({
			where: { videoId: id, isLike: true },
		});
		const dislikes = await this.prisma.videoLike.count({
			where: { videoId: id, isDislike: true },
		});

		return { ...video, _count: { ...video._count, likes, dislikes } };
	}
}
