export const AVATAR_FRAME_THICKNESS = ['thin', 'medium', 'thick'] as const
export type AvatarFrameThickness = (typeof AVATAR_FRAME_THICKNESS)[number]

export const AVATAR_FRAME_STYLE = ['gradient', 'solid', 'double', 'glow'] as const
export type AvatarFrameStyle = (typeof AVATAR_FRAME_STYLE)[number]
