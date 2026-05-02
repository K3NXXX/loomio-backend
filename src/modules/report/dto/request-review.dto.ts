import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

function trimTransform({ value }: { value: unknown }): string | undefined {
	if (typeof value === 'string') {
		return value.trim();
	}
	return undefined;
}

export class RequestReviewDto {
	@IsString()
	@Transform(trimTransform)
	@IsNotEmpty()
	@MaxLength(200)
	title: string;

	@IsOptional()
	@IsString()
	@Transform(trimTransform)
	@MaxLength(1000)
	description?: string;

	@IsOptional()
	@IsString()
	@Transform(trimTransform)
	tags?: string;

	@IsEnum(['yes', 'no'], { message: 'Audience must be either "yes" or "no"' })
	audience: 'yes' | 'no';

	@IsString()
	@Transform(trimTransform)
	@IsNotEmpty()
	channelId: string;

	/** Cloudflare Stream UID after client direct upload (preferred). Omit when sending multipart video file. */
	@IsOptional()
	@IsString()
	@Transform(trimTransform)
	videoPublicId?: string;
}
