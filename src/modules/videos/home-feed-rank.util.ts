export const HOME_FEED_MAX_CANDIDATES = 800
export const HOME_TASTE_LOOKBACK_MS = 30 * 86_400_000
/** Minimum watch events in the lookback window to infer taste. */
export const HOME_TASTE_MIN_VIEWS = 3
/**
 * User must have watched videos from at least this many different channels in the window
 * before we personalize. Use `1` for easier local testing; `3` is stricter for production.
 */
export const HOME_TASTE_MIN_DISTINCT_CHANNELS = 1
export const HOME_TASTE_TOP_CHANNELS = 8
export const HOME_TASTE_TOP_TAGS = 15

/** After this many taste-matched slots, insert discovery slots (see below). */
export const HOME_FEED_INTERLEAVE_PERSONALIZED_BURST = 3
/** Non–taste-matched videos (still ranked by global score) mixed into the feed. */
export const HOME_FEED_INTERLEAVE_DISCOVERY_BURST = 1

export type HomeTasteProfile = {
	channelIds: Set<string>
	tags: Set<string>
	/**
	 * Share of watch events in the taste window per channel (keys ⊆ channelIds).
	 * Sums to ~1 across the top channels slice used for personalization.
	 */
	channelWatchShare: Map<string, number>
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
	if (taste.channelIds.has(channelId)) {
		const fallbackShare = 1 / Math.max(1, taste.channelIds.size)
		const share = taste.channelWatchShare.get(channelId) ?? fallbackShare
		// Dominant channels (high share of your watch history) get a much larger lift so
		// their older / lower–global-engagement videos can still surface near the top.
		s += 0.16 + 0.40 * share
	}
	let tagHit = false
	for (const t of parseVideoTagTokens(videoTags)) {
		if (taste.tags.has(t)) {
			tagHit = true
			break
		}
	}
	if (tagHit) s += 0.16
	return Math.min(0.68, s)
}

type HomeFeedRow = {
	id: string
	createdAt: Date
	likesCount: number
	tags: string | null
	channel: { id: string; user: { isPremium: boolean } }
	_count: { views: number }
}

/**
 * Merge two ordered lists without repeating ids: take `personalizedBurst` from the first,
 * then `discoveryBurst` from the second, repeat until both are exhausted.
 */
export function interleavePersonalizedAndDiscovery<T extends { id: string }>(
	personalized: T[],
	discovery: T[],
	personalizedBurst: number,
	discoveryBurst: number,
): T[] {
	if (personalized.length === 0) return [...discovery]
	if (discovery.length === 0) return [...personalized]

	const seen = new Set<string>()
	const out: T[] = []

	const takeFrom = (list: T[], idx: { current: number }): boolean => {
		while (idx.current < list.length) {
			const item = list[idx.current++]
			if (!seen.has(item.id)) {
				seen.add(item.id)
				out.push(item)
				return true
			}
		}
		return false
	}

	const ip = { current: 0 }
	const id = { current: 0 }

	while (ip.current < personalized.length || id.current < discovery.length) {
		for (let b = 0; b < personalizedBurst; b++) {
			if (!takeFrom(personalized, ip)) break
		}
		for (let b = 0; b < discoveryBurst; b++) {
			if (!takeFrom(discovery, id)) break
		}
	}

	return out
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

	const sortedA = sortTier(tierA)
	const sortedB = sortTier(tierB)
	if (sortedA.length === 0) return sortedB
	if (sortedB.length === 0) return sortedA

	return interleavePersonalizedAndDiscovery(
		sortedA,
		sortedB,
		HOME_FEED_INTERLEAVE_PERSONALIZED_BURST,
		HOME_FEED_INTERLEAVE_DISCOVERY_BURST,
	)
}
