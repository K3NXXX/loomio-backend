import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdatePlaylistDto {
	@IsOptional()
	@IsString()
	@Length(2, 100)
	name?: string;

	@IsOptional()
	@IsString()
	@MaxLength(500)
	description?: string;

	@IsOptional()
	@Transform(({ value }) => value === 'true' || value === true)
	@IsBoolean()
	removeCover?: boolean;

	@IsOptional()
	@IsString()
	channelId?: string;
}
