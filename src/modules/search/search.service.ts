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

	async search(query: string) {
		if (!query.trim()) return { videos: [], channels: [] };

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

		const exactVideo = cleanedQuery
			? await this.prisma.video.findFirst({
					where: {
						title: { equals: cleanedQuery, mode: Prisma.QueryMode.insensitive },
					},
					select: {
						id: true,
						title: true,
						thumbnailFile: true,
						durationSeconds: true,
						createdAt: true,
						_count: { select: { views: true } },
						channel: {
							select: { id: true, name: true, username: true, avatarUrl: true, userId: true },
						},
					},
				})
			: null;

		const relatedVideos = await this.prisma.video.findMany({
			where: {
				AND: [exactVideo ? { id: { not: exactVideo.id } } : {}, videosWhere],
			},
			select: {
				id: true,
				title: true,
				thumbnailFile: true,
				durationSeconds: true,
				createdAt: true,
				_count: { select: { views: true } },
				channel: {
					select: { id: true, name: true, username: true, avatarUrl: true, userId: true },
				},
			},
			orderBy: { createdAt: 'desc' },
			take: 20,
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

		return {
			videos: exactVideo ? [exactVideo, ...relatedVideos] : relatedVideos,
			channels,
		};
	}
}
