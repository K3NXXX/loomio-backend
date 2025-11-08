import { IsOptional, IsString, Length, MaxLength } from 'class-validator'

export class UpdatePlaylistDto {
	@IsOptional()
	@IsString()
	@Length(2, 100)
	name?: string

	@IsOptional()
	@IsString()
	@MaxLength(500)
	description?: string
}
