import { ThemeColors } from '@prisma/client'

/** Stored enum values that require an active Premium subscription. */
export const PREMIUM_THEME_IDS = new Set<ThemeColors>([
	ThemeColors.PREMIUM,
	ThemeColors.PREMIUM_ORCHID,
	ThemeColors.PREMIUM_DENIM,
	ThemeColors.PREMIUM_BLUSH,
	ThemeColors.PREMIUM_CLAY,
	ThemeColors.PREMIUM_GRAPHITE,
	ThemeColors.PREMIUM_HONEY,
	ThemeColors.PREMIUM_IRIS,
	ThemeColors.PREMIUM_CITRINE,
	ThemeColors.PREMIUM_LAGOON,
	ThemeColors.PREMIUM_LILAC,
	ThemeColors.PREMIUM_SPRING,
	ThemeColors.CUSTOM,
])

export function requiresPremiumSubscription(theme: ThemeColors): boolean {
	return PREMIUM_THEME_IDS.has(theme)
}

export function resolveEffectiveTheme(
	theme: ThemeColors,
	isPremium: boolean,
): ThemeColors {
	if (!isPremium && requiresPremiumSubscription(theme)) {
		return ThemeColors.BLUE
	}
	return theme
}
