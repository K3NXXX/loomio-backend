import { IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SessionDto {
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
