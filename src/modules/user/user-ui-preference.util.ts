import {
	AppearanceMode,
	Locale,
	ThemeColors,
	type User,
	type UserUiPreference,
} from '@prisma/client';

import { resolveEffectiveTheme } from './theme-policy.util';

type UiPrefsFields = Pick<UserUiPreference, 'theme' | 'customTheme' | 'appearance' | 'locale'>;

export function uiPrefsFromRecord(pref: UserUiPreference | UiPrefsFields | null | undefined) {
	if (!pref) {
		return {
			theme: ThemeColors.BLUE,
			customTheme: null as UserUiPreference['customTheme'],
			appearance: AppearanceMode.DARK,
			locale: Locale.UK,
		};
	}

	return {
		theme: pref.theme,
		customTheme: pref.customTheme ?? null,
		appearance: pref.appearance,
		locale: pref.locale,
	};
}

/** Public API shape: same fields as legacy flat `users` columns. */
export function toPublicUserWithUiPrefs(
	user: Omit<User, 'password'> & { uiPreference?: UserUiPreference | null },
) {
	const { uiPreference, ...core } = user;
	const prefs = uiPrefsFromRecord(uiPreference ?? null);

	return {
		...core,
		theme: prefs.theme,
		customTheme: prefs.customTheme as UserUiPreference['customTheme'],
		appearance: prefs.appearance,
		locale: prefs.locale,
	};
}

/** Payload for CookieService.syncUiCookies (effective theme + custom when Premium). */
export function buildUiCookieSyncPayload(
	isPremium: boolean,
	prefs: ReturnType<typeof uiPrefsFromRecord>,
): {
	theme: string;
	locale: Locale;
	appearance: AppearanceMode;
	customTheme?: { background: string; primary: string } | null;
} {
	const effective = resolveEffectiveTheme(prefs.theme, isPremium);
	const custom =
		effective === ThemeColors.CUSTOM &&
		isPremium &&
		prefs.customTheme &&
		typeof prefs.customTheme === 'object' &&
		!Array.isArray(prefs.customTheme)
			? (prefs.customTheme as { background: string; primary: string })
			: null;

	return {
		theme: String(effective),
		locale: prefs.locale,
		appearance: prefs.appearance,
		customTheme: custom,
	};
}

/** When the user payload is already flattened (e.g. after `toPublicUserWithUiPrefs`). */
export function buildUiCookieSyncPayloadFromFlat(user: {
	isPremium: boolean;
	theme: ThemeColors;
	locale: Locale;
	appearance: AppearanceMode;
	customTheme: UserUiPreference['customTheme'];
}) {
	return buildUiCookieSyncPayload(user.isPremium, {
		theme: user.theme,
		customTheme: user.customTheme,
		appearance: user.appearance,
		locale: user.locale,
	});
}
