import { AppearanceMode, Locale, Prisma, ThemeColors, User } from '@prisma/client';

/** User row without password, with UI prefs flattened (former `users.theme` etc.). */
export type AuthUserResponse = Omit<User, 'password'> & {
	theme: ThemeColors;
	customTheme: Prisma.JsonValue;
	appearance: AppearanceMode;
	locale: Locale;
};

export interface TokenPair {
	user: AuthUserResponse;
	accessToken: string;
	refreshToken: string;
}
