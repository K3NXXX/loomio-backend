import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class UpdateChannelDto {
	@IsOptional()
	@IsString()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@Length(2, 50, { message: 'Channel name must be 2-50 characters' })
	@Matches(/^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ0-9\s'’`-]+$/, {
		message: 'Name can contain only letters, numbers, spaces, apostrophes, or dashes',
	})
	name?: string;

	@IsOptional()
	@IsString()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
	@Length(3, 20, { message: 'Username must be 3-20 characters' })
	@Matches(/^[a-z0-9_]+$/, {
		message: 'Username must contain only lowercase letters, numbers, and underscores',
	})
	username?: string;

	@IsOptional()
	@IsString()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@MaxLength(1000, { message: 'Description must be at most 1000 characters' })
	description?: string;

	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) => value === 'true' || value === true)
	removeAvatar?: boolean

	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) => value === 'true' || value === true)
	removeBanner?: boolean
}
