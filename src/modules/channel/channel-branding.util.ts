export type ChannelWithBrandingRelation = {
	branding: {
		avatarFrameColor: string | null
		avatarFrameThickness: string | null
		avatarFrameStyle: string | null
	} | null
}

export function flattenChannelBranding<T extends ChannelWithBrandingRelation>(
	row: T,
): Omit<T, 'branding'> & {
	avatarFrameColor: string | null
	avatarFrameThickness: string | null
	avatarFrameStyle: string | null
} {
	const { branding, ...rest } = row
	return {
		...rest,
		avatarFrameColor: branding?.avatarFrameColor ?? null,
		avatarFrameThickness: branding?.avatarFrameThickness ?? null,
		avatarFrameStyle: branding?.avatarFrameStyle ?? null,
	}
}
