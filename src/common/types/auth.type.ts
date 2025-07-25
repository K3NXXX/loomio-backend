export type OAuthUser = {
	fullName: string;
	username: string;
	email: string;
	avatarUrl?: string;
	provider: string;
	providerId: string;
};
