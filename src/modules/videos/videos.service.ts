import { CloudflareImagesService } from '@/common/libs/cloudflare/cloudflare-images.service';
import { CloudflareStreamService } from '@/common/libs/cloudflare/cloudflare-stream.service';
import { extractCloudflareStreamUidFromVideoUrl } from '@/common/libs/cloudflare/stream-video.utils';
import { CloudinaryService } from '@/common/libs/cloudinary/cloudinary.service';
import { PrismaService } from '@/common/prisma/prisma.service';
import {
	BadGatewayException,
	BadRequestException,
	ForbiddenException,
	GatewayTimeoutException,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import axios from 'axios';
import { UploadApiResponse } from 'cloudinary';
import type { Readable } from 'stream';
import { NotificationsGateway } from '../notification/notification.gateway';
import { NotificationService } from '../notification/notification.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { PublicVideosQueryDto } from './dto/public-videos-query.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import {
	HOME_FEED_MAX_CANDIDATES,
	HOME_TASTE_LOOKBACK_MS,
	HOME_TASTE_MIN_DISTINCT_CHANNELS,
	HOME_TASTE_MIN_VIEWS,
	HOME_TASTE_TOP_CHANNELS,
	HOME_TASTE_TOP_TAGS,
	type HomeTasteProfile,
	parseVideoTagTokens,
	rankHomeFeedVideos,
} from './home-feed-rank.util';
import { parseChaptersJson } from './utils/chapter-timecode.util';

const RECOMMENDED_SIDEBAR_TOTAL = 10;
const RECOMMENDED_SIDEBAR_SAME_CHANNEL_MAX = 3;

const HOME_FEED_TASTE_CHANNEL_EXTRA = 200;

function attachmentBasename(
	title: string | null | undefined,
	videoId: string,
	ext: '.mp4' | '.webm',
) {
	const trimmed = String(title ?? '')
		.replace(/[<>"/\\|?*\u0000-\u001F]+/g, '')
		.trim()
		.slice(0, 116);
	let slug = trimmed.replace(/\s+/g, '-').replace(/-+/g, '-');
	if (!slug) slug = `loomio-${videoId.slice(0, 12)}`;
	return `${slug}${ext}`;
}

@Injectable()
export class VideosService {
	private readonly logger = new Logger(VideosService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudinary: CloudinaryService,
		private readonly notificationService: NotificationService,
		private readonly notificationsGateway: NotificationsGateway,
		private readonly cloudflareStream: CloudflareStreamService,
		private readonly cloudflareImages: CloudflareImagesService,
	) {}

	private streamUidForVideo(v: { videoPublicId: string | null; videoFile: string }): string | null {
		const id = v.videoPublicId?.trim();
		if (id) return id;
		return extractCloudflareStreamUidFromVideoUrl(v.videoFile);
	}

	private async syncDurationFromStreamIfMissing(
		videoId: string,
		videoPublicId: string | null,
		videoFile: string,
		opts: { attempts: number; delayMs: number } = { attempts: 4, delayMs: 2000 },
	): Promise<number | null> {
		const uid = this.streamUidForVideo({ videoPublicId, videoFile });
		if (!uid) return null;
		try {
			const d = await this.cloudflareStream.getVideoDurationSecondsWithRetry(uid, opts);
			if (d != null) {
				await this.prisma.video.update({ where: { id: videoId }, data: { durationSeconds: d } });
			}
			return d;
		} catch {
			return null;
		}
	}

	async create(
		createVideoDto: CreateVideoDto,
		files: { thumbnail?: Express.Multer.File[] },
		userId: string,
	) {
		const thumbnailFile = files.thumbnail?.[0];

		if (!thumbnailFile) {
			throw new InternalServerErrorException('Thumbnail file missing');
		}

		const {
			channelId,
			title,
			description,
			tags,
			visibility,
			audience,
			publishType,
			publishDate,
			videoPublicId,
			chapters: chaptersRaw,
		} = createVideoDto;

		const channel = await this.prisma.channel.findUnique({
			where: { id: channelId },
			select: { id: true, userId: true, name: true },
		});

		if (!channel) {
			throw new NotFoundException('Channel not found');
		}
		if (channel.userId !== userId) {
			throw new ForbiddenException('You are not allowed to upload to this channel');
		}

		const chaptersNormalized = parseChaptersJson(chaptersRaw);

		try {
			const uploadedThumbnail = await this.cloudflareImages.uploadImage(thumbnailFile);

			let durationSeconds: number | null = null;
			try {
				durationSeconds = await this.cloudflareStream.getVideoDurationSecondsWithRetry(
					videoPublicId,
					{ attempts: 5, delayMs: 1500 },
				);
			} catch {
				/* Stream may still be encoding — synced on read */
			}

			const newVideo = await this.prisma.video.create({
				data: {
					title,
					description,
					tags,
					visibility,
					audience,
					publishType,
					publishDate: publishDate ? new Date(publishDate) : null,
					videoFile: `https://videodelivery.net/${videoPublicId}/manifest/video.m3u8`,
					videoPublicId,
					thumbnailFile: uploadedThumbnail.url,
					thumbnailPublicId: uploadedThumbnail.id,
					channelId,
					durationSeconds,
					chapters:
						chaptersNormalized != null ? (chaptersNormalized as Prisma.InputJsonValue) : undefined,
				},
			});

			if (publishType === 'now' && visibility === 'public') {
				const followers = await this.prisma.channelFollow.findMany({
					where: { channelId, notificationsEnabled: true },
					select: { followerId: true },
				});

				const channelName = channel.name ?? 'Someone';

				await Promise.all(
					followers.map(async ({ followerId }) => {
						const notification = await this.notificationService.create({
							type: NotificationType.VIDEO_PUBLISHED,
							message: `${channelName} published a new video: ${title}`,
							userId: followerId,
							authorId: userId,
							channelId,
							videoId: newVideo.id,
						});

						this.notificationsGateway.sendNotification(followerId, {
							id: notification.id,
							type: notification.type,
							message: notification.message,
							createdAt: notification.createdAt,
							authorId: userId,
							channelId,
							videoId: newVideo.id,
						});
					}),
				);
			}

			return { message: 'Video created', data: newVideo };
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			throw new InternalServerErrorException(`Failed to create video: ${errorMessage}`);
		}
	}

	async getStatus(videoId: string) {
		return this.cloudflareStream.getVideoStatus(videoId);
	}

	private async buildHomeTasteProfile(
		userId: string,
		audience: 'yes' | 'no',
	): Promise<HomeTasteProfile | null> {
		const since = new Date(Date.now() - HOME_TASTE_LOOKBACK_MS);
		const views = await this.prisma.videoView.findMany({
			where: {
				userId,
				createdAt: { gte: since },
				video: { audience },
			},
			select: {
				video: {
					select: { channelId: true, tags: true },
				},
			},
			orderBy: { createdAt: 'desc' },
			take: 600,
		});
		if (views.length < HOME_TASTE_MIN_VIEWS) return null;

		const distinctChannelIds = new Set(views.map((v) => v.video.channelId));
		if (distinctChannelIds.size < HOME_TASTE_MIN_DISTINCT_CHANNELS) return null;

		const channelCounts = new Map<string, number>();
		const tagCounts = new Map<string, number>();
		for (const v of views) {
			const cid = v.video.channelId;
			channelCounts.set(cid, (channelCounts.get(cid) ?? 0) + 1);
			for (const t of parseVideoTagTokens(v.video.tags)) {
				tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
			}
		}
		const topChannelEntries = [...channelCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, HOME_TASTE_TOP_CHANNELS);
		const sumTopChannelViews = topChannelEntries.reduce((s, [, c]) => s + c, 0);
		const channelWatchShare = new Map(
			topChannelEntries.map(([id, c]) => [id, sumTopChannelViews > 0 ? c / sumTopChannelViews : 0]),
		);
		const topTags = [...tagCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, HOME_TASTE_TOP_TAGS)
			.map(([t]) => t);
		return {
			channelIds: new Set(topChannelEntries.map(([id]) => id)),
			tags: new Set(topTags),
			channelWatchShare,
		};
	}

	async findAll(viewerUserId?: string | null, query?: PublicVideosQueryDto) {
		const page = Math.max(1, query?.page ?? 1);
		const limit = Math.min(60, Math.max(1, query?.limit ?? 24));
		const feed = query?.feed === 'kids' ? 'kids' : 'home';
		const audience = feed === 'kids' ? ('yes' as const) : ('no' as const);

		const taste =
			viewerUserId != null && viewerUserId !== ''
				? await this.buildHomeTasteProfile(viewerUserId, audience)
				: null;

		const homeFeedSelect = {
			id: true,
			title: true,
			description: true,
			tags: true,
			thumbnailFile: true,
			videoFile: true,
			videoPublicId: true,
			durationSeconds: true,
			likesCount: true,
			createdAt: true,
			channel: {
				select: {
					id: true,
					username: true,
					name: true,
					avatarUrl: true,
					userId: true,
					user: { select: { isPremium: true } },
					_count: { select: { followers: true } },
				},
			},
			_count: { select: { views: true } },
		} satisfies Prisma.VideoSelect;

		const publicFeedWhere = {
			visibility: 'public' as const,
			publishType: 'now' as const,
			audience,
		};

		let rows = await this.prisma.video.findMany({
			where: publicFeedWhere,
			orderBy: { createdAt: 'desc' },
			take: HOME_FEED_MAX_CANDIDATES,
			select: homeFeedSelect,
		});

		if (taste && taste.channelIds.size > 0) {
			const fromWatchedChannels = await this.prisma.video.findMany({
				where: {
					...publicFeedWhere,
					channelId: { in: [...taste.channelIds] },
				},
				orderBy: { createdAt: 'desc' },
				take: HOME_FEED_TASTE_CHANNEL_EXTRA,
				select: homeFeedSelect,
			});
			const byId = new Map(rows.map((v) => [v.id, v]));
			for (const v of fromWatchedChannels) {
				if (!byId.has(v.id)) byId.set(v.id, v);
			}
			rows = [...byId.values()];
		}

		const nowMs = Date.now();
		const ranked = rankHomeFeedVideos(rows, taste, nowMs);
		const start = (page - 1) * limit;
		const slice = ranked.slice(start, start + limit);

		for (const v of slice) {
			if (v.durationSeconds != null) continue;
			const d = await this.syncDurationFromStreamIfMissing(v.id, v.videoPublicId, v.videoFile, {
				attempts: 3,
				delayMs: 2000,
			});
			if (d != null) v.durationSeconds = d;
		}

		const items = slice.map(({ videoPublicId: _vp, channel, ...rest }) => {
			const { user: _u, ...ch } = channel;
			return { ...rest, channel: ch };
		});

		return {
			items,
			page,
			limit,
			hasMore: start + slice.length < ranked.length,
		};
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
				durationSeconds: true,
				createdAt: true,
				tags: true,
				videoPublicId: true,
				chapters: true,
				audience: true,
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

		if (video.durationSeconds == null) {
			const d = await this.syncDurationFromStreamIfMissing(
				video.id,
				video.videoPublicId,
				video.videoFile,
				{ attempts: 4, delayMs: 2000 },
			);
			if (d != null) {
				video.durationSeconds = d;
			}
		}

		return video;
	}

	async pipePremiumDownload(
		userId: string,
		videoId: string,
	): Promise<{
		stream: Readable;
		contentType: string;
		contentDisposition: string;
		contentLength?: number;
	}> {
		const subscriber = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { isPremium: true },
		});

		if (!subscriber) {
			throw new ForbiddenException('User not found');
		}
		if (!subscriber.isPremium) {
			throw new ForbiddenException('Premium subscription required to download videos');
		}

		const video = await this.prisma.video.findFirst({
			where: {
				id: videoId,
				visibility: 'public',
			},
			select: {
				title: true,
				videoFile: true,
				videoPublicId: true,
			},
		});

		if (!video) {
			throw new NotFoundException('Video not found or cannot be downloaded');
		}

		let upstreamUrl: string;
		let ext: '.mp4' | '.webm' = '.mp4';

		const uid = this.streamUidForVideo({
			videoPublicId: video.videoPublicId,
			videoFile: video.videoFile,
		});

		if (uid) {
			try {
				upstreamUrl = await this.cloudflareStream.resolveMp4DownloadUrl(uid);
			} catch (e: unknown) {
				const msg =
					e instanceof Error ? e.message : 'Could not prepare Cloudflare Stream MP4 download';
				this.logger.warn(`pipePremiumDownload resolveMp4 videoId=${videoId} uid=${uid}: ${msg}`);
				if (/timed out/i.test(msg)) {
					throw new GatewayTimeoutException(msg);
				}
				throw new BadGatewayException(msg);
			}
		} else {
			const vf = (video.videoFile || '').trim();
			const pathOnly = vf.split('?')[0] ?? vf;
			if (/^https?:\/\/.+/i.test(vf) && /\.webm$/i.test(pathOnly)) {
				ext = '.webm';
				upstreamUrl = vf;
			} else if (/^https?:\/\/.+/i.test(vf) && /\.mp4$/i.test(pathOnly)) {
				ext = '.mp4';
				upstreamUrl = vf;
			} else {
				throw new BadRequestException('Download is not available for this video');
			}
		}

		let stream: Readable;
		let contentType: string;
		let upstreamContentLength: number | undefined;

		try {
			const resp = await axios.get<Readable>(upstreamUrl, {
				responseType: 'stream',
				maxRedirects: 10,
				maxBodyLength: Infinity,
				maxContentLength: Infinity,
				validateStatus: (s) => s >= 200 && s < 400,
			});

			stream = resp.data;
			contentType =
				(typeof resp.headers['content-type'] === 'string' ? resp.headers['content-type'] : null) ??
				(ext === '.webm' ? 'video/webm' : 'video/mp4');

			upstreamContentLength = VideosService.pickPositiveContentLength(
				resp.headers['content-length'],
			);
		} catch (e: unknown) {
			let detail = `Upstream fetch failed for ${videoId}`;
			if (axios.isAxiosError(e)) {
				const hs = e.response?.status ?? 'n/a';
				const hdr =
					typeof e.response?.headers?.['content-type'] === 'string'
						? e.response.headers['content-type']
						: '';
				detail += ` — HTTP ${hs} ${e.code ?? ''}${hdr ? ` ct=${hdr}` : ''}`;
				const shortUrl = upstreamUrl.startsWith('http')
					? upstreamUrl.split('?')[0].slice(0, 88) + '…'
					: upstreamUrl;
				this.logger.warn(`pipePremiumDownload stream GET ${detail} url=${shortUrl}`);
				if (e.response?.status === 403) {
					throw new BadGatewayException(
						'CDN denied access to the MP4 (403). If Stream uses signed URLs, enable downloadable MP4 signing.',
					);
				}
				if (e.response?.status === 404) {
					throw new BadGatewayException(
						'MP4 not found at CDN (404). Retry after Cloudflare finishes encoding the download.',
					);
				}
			}
			this.logger.warn(
				`pipePremiumDownload stream GET unexpected: ${e instanceof Error ? e.message : String(e)}`,
			);
			throw new BadGatewayException(`${detail}: ${e instanceof Error ? e.message : String(e)}`);
		}

		const basename = attachmentBasename(video.title, videoId, ext);
		const contentDisposition = `attachment; filename="video${ext}"; filename*=UTF-8''${encodeURIComponent(basename)}`;

		return {
			stream,
			contentType,
			contentDisposition,
			...(upstreamContentLength != null ? { contentLength: upstreamContentLength } : {}),
		};
	}

	/** Axios / Node may surface Content-Length as string | string[]. */
	static pickPositiveContentLength(raw: unknown): number | undefined {
		let s: string | undefined;
		if (typeof raw === 'string') s = raw;
		else if (Array.isArray(raw) && raw.length && typeof raw[0] === 'string') s = raw[0];
		if (!s?.trim()) return undefined;
		const n = parseInt(String(s).trim(), 10);
		if (!Number.isFinite(n) || n <= 0) return undefined;
		return n;
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

			const {
				title,
				description,
				tags,
				visibility,
				audience,
				publishType,
				publishDate,
				chapters: chaptersRaw,
			} = updateVideoDto;

			const data: any = {};

			if (title !== undefined) data.title = title;
			if (description !== undefined) data.description = description;
			if (tags !== undefined) data.tags = tags;
			if (visibility !== undefined) {
				data.visibility = visibility;
				if (visibility !== 'restricted' && visibility !== 'pending_review') {
					data.restrictionModeratorReason = null;
					data.restrictionModeratorNote = null;
				}
			}
			if (audience !== undefined) data.audience = audience;
			if (publishType !== undefined) data.publishType = publishType;

			if (publishDate !== undefined) {
				data.publishDate = publishDate ? new Date(publishDate) : null;
			}

			if (chaptersRaw !== undefined) {
				const chaptersNormalized = parseChaptersJson(chaptersRaw);
				data.chapters =
					chaptersNormalized === undefined
						? Prisma.JsonNull
						: (chaptersNormalized as Prisma.InputJsonValue);
			}

			if (videoFileUrl) data.videoFile = videoFileUrl;
			if (thumbnailFileUrl) data.thumbnailFile = thumbnailFileUrl;

			const updatedVideo = await this.prisma.video.update({
				where: { id },
				data,
			});

			return { message: 'Video successfully updated', data: updatedVideo };
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			console.error('Video update error:', errorMessage);
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
				await this.cloudflareStream.deleteVideo(video.videoPublicId);
			}

			if (video.thumbnailPublicId) {
				await this.cloudflareImages.deleteImage(video.thumbnailPublicId);
			}

			await this.prisma.video.delete({ where: { id } });

			return { message: 'Video successfully deleted' };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new InternalServerErrorException(`Failed to delete video: ${message}`);
		}
	}

	async getUploadUrl() {
		return this.cloudflareStream.createDirectUpload();
	}

	async deleteTemp(videoId: string) {
		try {
			await this.cloudflareStream.deleteVideo(videoId);
			return { success: true };
		} catch (err) {
			throw new InternalServerErrorException('Failed to delete temp video');
		}
	}

	async getRecommended(videoId: string) {
		const current = await this.prisma.video.findUnique({
			where: { id: videoId },
			select: { id: true, tags: true, channelId: true, audience: true },
		});

		if (!current) return [];

		const audience = current.audience ?? 'no';
		const audienceWhere = { audience };

		const tagTokens = current.tags ? current.tags.split(/[\s,]+/).filter(Boolean) : [];

		const recommendedSelect = {
			id: true,
			title: true,
			thumbnailFile: true,
			durationSeconds: true,
			createdAt: true,
			likesCount: true,
			dislikesCount: true,
			tags: true,
			videoPublicId: true,
			videoFile: true,
			visibility: true,
			publishType: true,
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
		} satisfies Prisma.VideoSelect;

		const fromSameChannel = await this.prisma.video.findMany({
			where: {
				publishType: 'now',
				visibility: 'public',
				id: { not: current.id },
				channelId: current.channelId,
			},
			select: recommendedSelect,
			orderBy: [{ createdAt: 'desc' }],
			take: RECOMMENDED_SIDEBAR_SAME_CHANNEL_MAX,
		});

		const picked = new Set(fromSameChannel.map((v) => v.id));
		const merged = [...fromSameChannel];

		const tagOr: Prisma.VideoWhereInput[] =
			tagTokens.length > 0
				? tagTokens.map((t) => ({
						tags: { contains: t, mode: Prisma.QueryMode.insensitive },
					}))
				: [];

		if (merged.length < RECOMMENDED_SIDEBAR_TOTAL && tagOr.length > 0) {
			const need = RECOMMENDED_SIDEBAR_TOTAL - merged.length;
			const fromTags = await this.prisma.video.findMany({
				where: {
					publishType: 'now',
					visibility: 'public',
					...audienceWhere,
					id: { not: current.id },
					channelId: { not: current.channelId },
					OR: tagOr,
				},
				select: recommendedSelect,
				orderBy: [{ createdAt: 'desc' }],
				take: Math.max(need, RECOMMENDED_SIDEBAR_TOTAL) + 5,
			});

			for (const v of fromTags) {
				if (merged.length >= RECOMMENDED_SIDEBAR_TOTAL) break;
				if (!picked.has(v.id)) {
					picked.add(v.id);
					merged.push(v);
				}
			}
		}

		if (merged.length < RECOMMENDED_SIDEBAR_TOTAL) {
			const idExclude =
				picked.size > 0 ? { not: current.id, notIn: [...picked] as string[] } : { not: current.id };
			const filler = await this.prisma.video.findMany({
				where: {
					publishType: 'now',
					visibility: 'public',
					...audienceWhere,
					id: idExclude,
					channelId: { not: current.channelId },
				},
				select: recommendedSelect,
				orderBy: [{ likesCount: 'desc' }, { createdAt: 'desc' }],
				take: RECOMMENDED_SIDEBAR_TOTAL + 8,
			});
			for (const v of filler) {
				if (merged.length >= RECOMMENDED_SIDEBAR_TOTAL) break;
				if (!picked.has(v.id)) {
					picked.add(v.id);
					merged.push(v);
				}
			}
		}

		return merged.slice(0, RECOMMENDED_SIDEBAR_TOTAL);
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

	async addVideosToPlaylist(userId: string, playlistId: string, videoIds: string[]) {
		const playlist = await this.prisma.playlist.findUnique({
			where: { id: playlistId },
			include: { channel: { select: { userId: true } } },
		});

		if (!playlist) throw new NotFoundException('Playlist not found');

		if (playlist.channelId) {
			if (playlist.channel?.userId !== userId) throw new ForbiddenException('Not your channel');
		} else {
			if (playlist.userId !== userId) throw new ForbiddenException('Not your playlist');
		}

		await this.prisma.playlist.update({
			where: { id: playlistId },
			data: {
				videos: {
					connect: videoIds.map((id) => ({ id })),
				},
			},
		});

		return { added: videoIds.length };
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

	async findAllForChannelStudio(channelId: string, userId: string) {
		const channel = await this.prisma.channel.findUnique({
			where: { id: channelId },
			select: { userId: true },
		});
		if (!channel) throw new NotFoundException('Channel not found');
		if (channel.userId !== userId) {
			throw new ForbiddenException('You are not allowed to view this studio');
		}

		const videos = await this.prisma.video.findMany({
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
				durationSeconds: true,
				createdAt: true,
				restrictionModeratorReason: true,
				restrictionModeratorNote: true,
				chapters: true,
				_count: { select: { views: true, likes: true, comments: true } },
			},
		});

		const moderationMetaVideoIds = videos
			.filter((v) => v.visibility === 'restricted' || v.visibility === 'pending_review')
			.map((v) => v.id);

		if (moderationMetaVideoIds.length === 0) {
			return videos;
		}

		const reports = await this.prisma.report.findMany({
			where: {
				videoId: { in: moderationMetaVideoIds },
				OR: [{ moderatorRestrictionReason: { not: null } }, { moderatorNote: { not: null } }],
			},
			orderBy: { createdAt: 'desc' },
			select: {
				videoId: true,
				moderatorRestrictionReason: true,
				moderatorNote: true,
			},
		});

		const fallbackByVideoId = new Map<
			string,
			{
				moderatorRestrictionReason: (typeof reports)[number]['moderatorRestrictionReason'];
				moderatorNote: string | null;
			}
		>();

		for (const r of reports) {
			if (!r.videoId || fallbackByVideoId.has(r.videoId)) continue;
			fallbackByVideoId.set(r.videoId, {
				moderatorRestrictionReason: r.moderatorRestrictionReason,
				moderatorNote: r.moderatorNote,
			});
		}

		return videos.map((v) => {
			const fb = fallbackByVideoId.get(v.id);
			const needsMeta = v.visibility === 'restricted' || v.visibility === 'pending_review';
			if (!fb || !needsMeta) {
				return v;
			}
			return {
				...v,
				restrictionModeratorReason:
					v.restrictionModeratorReason ?? fb.moderatorRestrictionReason ?? null,
				restrictionModeratorNote: v.restrictionModeratorNote ?? fb.moderatorNote ?? null,
			};
		});
	}
}
