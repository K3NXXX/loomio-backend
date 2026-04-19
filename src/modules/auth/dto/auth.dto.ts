import {
	IsEmail,
	IsNotEmpty,
	IsOptional,
	IsString,
	Length,
	Matches,
	MaxLength,
	MinLength,
	Validate,
} from 'class-validator';

import { IsPasswordsMatch } from '../../../common/decorators/is-pwds-match.decorator';

export class SignupDto {
	@IsString()
	@IsOptional()
	@Length(2, 255)
	@Matches(
		/^(?!.*['\u2019]{2})(?!.* {2})(?!['\u2019 ])[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ''\- ]+(?<!['\u2019 ])$/,
		{
			message:
				'Name must contain only letters, single apostrophes or spaces (no repeats), and must not start or end with a space or apostrophe',
		},
	)
	name?: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(3)
	@MaxLength(39)
	username: string;

	@IsString()
	@IsNotEmpty()
	@IsEmail()
	email: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(8)
	password: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(8)
	@Validate(IsPasswordsMatch)
	confirmPassword: string;
}

export class LoginDto {
	@IsString()
	@IsNotEmpty()
	identifier: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(8)
	password: string;
}

export type SignupMeta = {
	name?: string
	username: string;
	email: string;
	password: string;
};
