import { IsString, Length, Matches } from 'class-validator';

export class CreateChannelDto {
	@IsString({ message: 'Channel name is required' })
	@Length(2, 50, { message: 'Channel name must be between 2 and 50 characters' })
	@Matches(/^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ0-9\s'’`-]+$/, {
		message: 'Name can contain only letters, numbers, spaces, apostrophes, or dashes',
	})
	name!: string;

	@IsString({ message: 'Username is required' })
	@Length(3, 20, { message: 'Username must be between 3 and 20 characters' })
	@Matches(/^[a-z0-9_]+$/, {
		message: 'Username must contain only lowercase letters, numbers, and underscores',
	})
	username!: string;
}
