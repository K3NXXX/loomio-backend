import { Audience, Visibility } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateVideoDto {
	@IsOptional()
	@IsString()
	title?: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@IsString()
	tags?: string;

	@IsOptional()
	@IsEnum(Visibility)
	visibility?: Visibility;

	@IsOptional()
	@IsEnum(Audience)
	audience?: Audience;

	@IsOptional()
	@IsString()
	publishType?: string; 

	@IsOptional()
	@IsString()
	publishDate?: string; 
}
