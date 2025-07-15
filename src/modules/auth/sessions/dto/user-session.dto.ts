import { IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UserSessionDto {
	@IsString()
	@IsNotEmpty()
	userId: string;

	@IsString()
	ip: string;

	@IsString()
	@IsOptional()
	userAgent?: string;

	@IsDate()
	expiresAt: Date;
}
