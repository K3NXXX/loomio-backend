import { Audience, PublishType, Visibility } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

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
	@IsEnum(PublishType)
	publishType?: PublishType;

	@IsOptional()
	@IsString()
	publishDate?: string;

	@IsOptional()
	@IsString()
	@MaxLength(20000, { message: 'Chapters payload is too large' })
	chapters?: string;
}
