import { PrismaService } from '@/common/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchService {
	constructor(private readonly prisma: PrismaService) {}

	// ==========================
	// 🔹 Підказки (autocomplete)
	// ==========================
	async getSuggestions(query: string) {
		if (!query.trim()) return [];

		// 🔹 @username
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
				type: 'channel',
				label: `@${c.username}`,
				id: c.id,
			}));
		}

		// 🔹 #теги
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
				type: 'tag',
				label: `${t}`,
				id: t,
			}));
		}

		// 🔹 Звичайний текстовий пошук
		const [videos, channels] = await Promise.all([
			this.prisma.video.findMany({
				where: {
					title: { contains: query, mode: Prisma.QueryMode.insensitive },
				},
				select: { id: true, title: true },
				take: 5,
			}),
			this.prisma.channel.findMany({
				where: {
					OR: [
						{ name: { contains: query, mode: Prisma.QueryMode.insensitive } },
						{ username: { contains: query, mode: Prisma.QueryMode.insensitive } },
					],
				},
				select: { id: true, name: true, username: true },
				take: 5,
			}),
		]);

		return [
			...channels.map((c) => ({
				type: 'channel',
				label: c.name || `@${c.username}`,
				id: c.id,
			})),
			...videos.map((v) => ({
				type: 'video',
				label: v.title,
				id: v.id,
			})),
		];
	}

	// ==========================
	// 🔹 Основний пошук
	// ==========================
	async search(query: string) {
		if (!query.trim()) return { videos: [], channels: [] };

		// @username → тільки канали
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
				},
			});
			return { videos: [], channels };
		}

		// #tags
		const hashtags = query.match(/#[\w\d]+/g)?.map((t) => t.replace('#', '').toLowerCase()) ?? [];
		const cleanedQuery = query.replace(/#[\w\d]+/g, '').trim();

		const textKeywords = cleanedQuery.split(/\s+/).filter(Boolean);
		const mainKeyword = textKeywords[0] || '';

		// ==========================
		// 🔹 Пошук відео (2 режими)
		// ==========================
		let videosWhere: Prisma.VideoWhereInput;

		if (hashtags.length) {
			// 🧩 Режим тегів: наприклад "#korn coming"
			// 1) хоча б один із тегів повинен бути в tags
			// 2) додатковий текст шукається в title/description (як "coming")
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
			// 🧩 Звичайний пошук без тегів
			// Беремо перше слово (korn) і по ньому шукаємо все, як раніше
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

		// 🔹 точний збіг по повній назві
		const exactVideo = cleanedQuery
			? await this.prisma.video.findFirst({
					where: {
						title: { equals: cleanedQuery, mode: Prisma.QueryMode.insensitive },
					},
					select: {
						id: true,
						title: true,
						thumbnailFile: true,
						createdAt: true,
						_count: { select: { views: true } },
						channel: {
							select: { id: true, name: true, username: true, avatarUrl: true },
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
				createdAt: true,
				_count: { select: { views: true } },
				channel: {
					select: { id: true, name: true, username: true, avatarUrl: true },
				},
			},
			orderBy: { createdAt: 'desc' },
			take: 20,
		});

		// 🔹 Канали — тільки якщо немає тегів
		let channels: {
			id: string;
			name: string;
			username: string;
			avatarUrl: string | null;
			bannerUrl: string | null;
			description: string | null;
			_count: { followers: number };
		}[] = [];

		if (!hashtags.length && cleanedQuery) {
			channels = await this.prisma.channel.findMany({
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
				},
			});
		}

		return {
			videos: exactVideo ? [exactVideo, ...relatedVideos] : relatedVideos,
			channels,
		};
	}
}
