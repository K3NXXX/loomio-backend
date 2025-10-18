import { IsOptional, IsString } from 'class-validator';

export class CreateViewDto {
	@IsOptional()
	@IsString()
	ip?: string;

	@IsOptional()
	@IsString()
	userAgent?: string;
}
