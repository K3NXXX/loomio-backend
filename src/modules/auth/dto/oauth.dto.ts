import { IsEmail, IsOptional, IsString } from 'class-validator';

export class OAuthDto {
	@IsOptional()
	@IsString()
	name: string;

	@IsString()
	username: string;

	@IsString()
	@IsEmail()
	email: string;

	@IsOptional()
	@IsEmail()
	providerEmail?: string;

	@IsOptional()
	@IsString()
	avatarUrl?: string;

	@IsString()
	provider: string;

	@IsString()
	providerId: string;
}
