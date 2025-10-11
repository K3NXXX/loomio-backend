import { Transform } from 'class-transformer';
import {
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	ValidateIf,
} from 'class-validator';

function trimTransform({ value }: { value: unknown }): string | undefined {
	if (typeof value === 'string') {
		return value.trim();
	}
	return undefined;
}

export class CreateVideoDto {
	@IsString()
	@Transform(trimTransform)
	@IsNotEmpty({ message: 'Title is required' })
	@MaxLength(200, { message: 'Title must be less than 200 characters' })
	title: string;

	@IsOptional()
	@IsString()
	@Transform(trimTransform)
	@MaxLength(1000, { message: 'Description must be less than 1000 characters' })
	description?: string;

	@IsOptional()
	@IsString()
	@Transform(trimTransform)
	@Matches(/^#\w+( #\w+)*$/, {
		message: 'Invalid tags format. Use format like: #tag #another',
	})
	tags?: string;

	@IsEnum(['public', 'private'], {
		message: 'Visibility must be either "public" or "private"',
	})
	visibility: 'public' | 'private';

	@IsEnum(['yes', 'no'], {
		message: 'Audience must be either "yes" or "no"',
	})
	audience: 'yes' | 'no';

	@IsEnum(['now', 'scheduled'], {
		message: 'Publish type must be either "now" or "scheduled"',
	})
	publishType: 'now' | 'scheduled';

	@IsOptional()
	@ValidateIf((o: CreateVideoDto) => o.publishType === 'scheduled')
	@IsString({ message: 'Publish date must be a string' })
	@Transform(trimTransform)
	publishDate?: string;
}

