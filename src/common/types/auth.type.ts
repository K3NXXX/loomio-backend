import { User } from '@prisma/client';

export type OAuthUser = User & {
	provider: string;
	providerId: string;
};
