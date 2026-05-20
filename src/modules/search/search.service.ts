import { flattenChannelBranding } from '@/modules/channel/channel-branding.util';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchService {
	constructor(private readonly prisma: PrismaService) {}

	async getSuggestions(query: string) {
		if (!query.trim()) return [];

		if (query.startsWith('@')) {
			const username = query.slice(1).trim();
			const channels = await this.prisma.channel.findMany({
				where: {
					username: { contains: username, mode: Prisma.QueryMode.insensitive },
				},
				select: {
					id: true,
					name: true,
					username: true,
					avatarUrl: true,
				},
				take: 5,
			});

			return channels.map((c) => ({
				type: 'channel' as const,
				label: `@${c.username}`,
				id: c.id,
				imageUrl: c.avatarUrl,
			}));
		}

		if (query.startsWith('#')) {
			const tag = query.slice(1).trim().toLowerCase();

			const videos = await this.prisma.video.findMany({
				where: {
					tags: { contains: tag, mode: Prisma.QueryMode.insensitive },
				},
				select: { tags: true },
				take: 30,
			});

			const allTags = videos.flatMap(
				(v) =>
					v.tags
						?.split(/[\s,]+/)
						.filter(Boolean)
						.map((t) => t.toLowerCase()) || [],
			);

			const uniqueTags = [...new Set(allTags)].filter((t) => t.includes(tag)).slice(0, 5);

			return uniqueTags.map((t) => ({
				type: 'tag' as const,
				label: `${t}`,
				id: t,
			}));
		}

		const [videos, channels] = await Promise.all([
			this.prisma.video.findMany({
				where: {
					title: { contains: query, mode: Prisma.QueryMode.insensitive },
				},
				select: { id: true, title: true, thumbnailFile: true },
				take: 5,
			}),
			this.prisma.channel.findMany({
				where: {
					OR: [
						{ name: { contains: query, mode: Prisma.QueryMode.insensitive } },
						{ username: { contains: query, mode: Prisma.QueryMode.insensitive } },
					],
				},
				select: { id: true, name: true, username: true, avatarUrl: true },
				take: 5,
			}),
		]);

		return [
			...channels.map((c) => ({
				type: 'channel' as const,
				label: c.name || `@${c.username}`,
				id: c.id,
				imageUrl: c.avatarUrl,
			})),
			...videos.map((v) => ({
				type: 'video' as const,
				label: v.title,
				id: v.id,
				imageUrl: v.thumbnailFile,
			})),
		];
	}

	private readonly videoSelect = {
		id: true,
		title: true,
		thumbnailFile: true,
		durationSeconds: true,
		createdAt: true,
		_count: { select: { views: true } },
		channel: {
			select: { id: true, name: true, username: true, avatarUrl: true, userId: true },
		},
	} as const;

	async search(query: string, page = 1, limit = 20) {
		const safePage = Math.max(1, page);
		const safeLimit = Math.min(Math.max(1, limit), 50);

		if (!query.trim()) {
			return {
				videos: [],
				channels: [],
				page: safePage,
				limit: safeLimit,
				totalVideos: 0,
				hasMore: false,
			};
		}

		if (query.startsWith('@')) {
			const username = query.slice(1).trim();
			const channels = await this.prisma.channel.findMany({
				where: {
					username: { contains: username, mode: Prisma.QueryMode.insensitive },
				},
				select: {
					id: true,
					name: true,
					username: true,
					avatarUrl: true,
					bannerUrl: true,
					description: true,
					_count: { select: { followers: true } },
					branding: {
						select: {
							avatarFrameColor: true,
							avatarFrameThickness: true,
							avatarFrameStyle: true,
						},
					},
				},
			});
			return {
				videos: [],
				channels: channels.map((c) => flattenChannelBranding(c)),
				page: safePage,
				limit: safeLimit,
				totalVideos: 0,
				hasMore: false,
			};
		}

		const hashtags = query.match(/#[\w\d]+/g)?.map((t) => t.replace('#', '').toLowerCase()) ?? [];
		const cleanedQuery = query.replace(/#[\w\d]+/g, '').trim();

		const textKeywords = cleanedQuery.split(/\s+/).filter(Boolean);
		const mainKeyword = textKeywords[0] || '';

		let videosWhere: Prisma.VideoWhereInput;

		if (hashtags.length) {
			videosWhere = {
				AND: [
					{
						OR: hashtags.map((tag) => ({
							tags: {
								contains: tag,
								mode: Prisma.QueryMode.insensitive,
							},
						})),
					},
					textKeywords.length
						? {
								OR: [
									{
										title: {
											contains: textKeywords.join(' '),
											mode: Prisma.QueryMode.insensitive,
										},
									},
									{
										description: {
											contains: textKeywords.join(' '),
											mode: Prisma.QueryMode.insensitive,
										},
									},
								],
							}
						: {},
				],
			};
		} else if (mainKeyword) {
			videosWhere = {
				OR: [
					{ title: { contains: mainKeyword, mode: Prisma.QueryMode.insensitive } },
					{ description: { contains: mainKeyword, mode: Prisma.QueryMode.insensitive } },
					{ tags: { contains: mainKeyword, mode: Prisma.QueryMode.insensitive } },
				],
			};
		} else {
			videosWhere = {};
		}

		const exactMatch = cleanedQuery
			? await this.prisma.video.findFirst({
					where: {
						title: { equals: cleanedQuery, mode: Prisma.QueryMode.insensitive },
					},
					select: this.videoSelect,
				})
			: null;

		const exactForPage = safePage === 1 ? exactMatch : null;

		const relatedWhere: Prisma.VideoWhereInput = {
			AND: [exactMatch ? { id: { not: exactMatch.id } } : {}, videosWhere],
		};

		const relatedCount = await this.prisma.video.count({ where: relatedWhere });
		const exactOffset = exactMatch ? 1 : 0;
		const firstPageRelatedTake = safeLimit - exactOffset;
		const relatedSkip =
			safePage === 1 ? 0 : firstPageRelatedTake + (safePage - 2) * safeLimit;
		const relatedTake = safePage === 1 ? firstPageRelatedTake : safeLimit;

		const relatedVideos = await this.prisma.video.findMany({
			where: relatedWhere,
			select: this.videoSelect,
			orderBy: { createdAt: 'desc' },
			skip: relatedSkip,
			take: relatedTake,
		});

		let channels: {
			id: string;
			name: string;
			username: string;
			avatarUrl: string | null;
			bannerUrl: string | null;
			avatarFrameColor: string | null;
			avatarFrameThickness: string | null;
			avatarFrameStyle: string | null;
			description: string | null;
			_count: { followers: number };
		}[] = [];

		if (!hashtags.length && cleanedQuery) {
			const channelsRaw = await this.prisma.channel.findMany({
				where: {
					OR: [
						{ name: { contains: mainKeyword, mode: Prisma.QueryMode.insensitive } },
						{ username: { contains: mainKeyword, mode: Prisma.QueryMode.insensitive } },
						{
							description: {
								contains: mainKeyword,
								mode: Prisma.QueryMode.insensitive,
							},
						},
					],
				},
				select: {
					id: true,
					name: true,
					username: true,
					avatarUrl: true,
					bannerUrl: true,
					description: true,
					_count: { select: { followers: true } },
					branding: {
						select: {
							avatarFrameColor: true,
							avatarFrameThickness: true,
							avatarFrameStyle: true,
						},
					},
				},
			});
			channels = channelsRaw.map((c) => flattenChannelBranding(c));
		}

		const videos = exactForPage ? [exactForPage, ...relatedVideos] : relatedVideos;
		const totalVideos = relatedCount + exactOffset;
		const loadedCount = exactOffset + relatedSkip + relatedVideos.length;

		return {
			videos,
			channels,
			page: safePage,
			limit: safeLimit,
			totalVideos,
			hasMore: loadedCount < totalVideos,
		};
	}
}
