import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OAuthDto {
	@IsString()
	@IsNotEmpty()
	fullName: string;

	@IsString()
	@IsNotEmpty()
	username: string;

	@IsString()
	@IsEmail()
	email: string;

	@IsOptional()
	@IsString()
	avatarUrl?: string;

	@IsString()
	@IsNotEmpty()
	provider: string;

	@IsString()
	@IsNotEmpty()
	providerId: string;
}
