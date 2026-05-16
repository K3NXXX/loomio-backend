export const HOME_FEED_MAX_CANDIDATES = 800
export const HOME_TASTE_LOOKBACK_MS = 30 * 86_400_000
export const HOME_TASTE_MIN_VIEWS = 3
export const HOME_TASTE_TOP_CHANNELS = 8
export const HOME_TASTE_TOP_TAGS = 15

export type HomeTasteProfile = {
	channelIds: Set<string>
	tags: Set<string>
}

export function parseVideoTagTokens(tags: string | null | undefined): string[] {
	if (!tags?.trim()) return []
	return tags
		.split(/[\s,]+/)
		.map((t) => t.trim().toLowerCase())
		.filter(Boolean)
}

export function homeFeedBaseScore(
	nowMs: number,
	v: {
		createdAt: Date
		likesCount: number
		_count: { views: number }
	},
): number {
	const ageDays = Math.max(0, (nowMs - v.createdAt.getTime()) / 86_400_000)
	const recency = Math.exp(-ageDays / 10)
	const rawEng =
		0.65 * Math.log1p(v._count.views) + 0.35 * Math.log1p(v.likesCount)
	const engagement = Math.min(1, rawEng / 12)
	return 0.45 * recency + 0.55 * engagement
}

export function premiumOwnerBoost(isPremium: boolean): number {
	return isPremium ? 0.06 : 0
}

export function videoMatchesTaste(
	channelId: string,
	videoTags: string | null,
	taste: HomeTasteProfile,
): boolean {
	if (taste.channelIds.has(channelId)) return true
	for (const t of parseVideoTagTokens(videoTags)) {
		if (taste.tags.has(t)) return true
	}
	return false
}

export function tasteMatchScore(
	channelId: string,
	videoTags: string | null,
	taste: HomeTasteProfile,
): number {
	let s = 0
	if (taste.channelIds.has(channelId)) s += 0.22
	let tagHit = false
	for (const t of parseVideoTagTokens(videoTags)) {
		if (taste.tags.has(t)) {
			tagHit = true
			break
		}
	}
	if (tagHit) s += 0.16
	return Math.min(0.34, s)
}

type HomeFeedRow = {
	createdAt: Date
	likesCount: number
	tags: string | null
	channel: { id: string; user: { isPremium: boolean } }
	_count: { views: number }
}

export function rankHomeFeedVideos<T extends HomeFeedRow>(
	rows: T[],
	taste: HomeTasteProfile | null,
	nowMs: number,
): T[] {
	const score = (v: T) => {
		const base = homeFeedBaseScore(nowMs, v)
		const prem = premiumOwnerBoost(v.channel.user.isPremium)
		const match =
			taste && videoMatchesTaste(v.channel.id, v.tags, taste)
				? tasteMatchScore(v.channel.id, v.tags, taste)
				: 0
		return base + prem + match
	}

	const sortTier = (arr: T[]) =>
		[...arr].sort((a, b) => {
			const da = score(a)
			const db = score(b)
			if (Math.abs(db - da) > 1e-9) return db - da
			return b.createdAt.getTime() - a.createdAt.getTime()
		})

	if (!taste) {
		return sortTier(rows)
	}

	const tierA: T[] = []
	const tierB: T[] = []
	for (const v of rows) {
		if (videoMatchesTaste(v.channel.id, v.tags, taste)) tierA.push(v)
		else tierB.push(v)
	}
	return [...sortTier(tierA), ...sortTier(tierB)]
}
