import { UserRole } from '@prisma/client';

export interface AuthUser {
	id?: string;
	firstName: string;
	lastName: string;
	email: string;
	password?: string | null;
	avatarUrl?: string;
	role?: UserRole;
}

export interface OAuthUser extends AuthUser {
	provider: string;
	providerId: string;
}
