import {
	IsEmail,
	IsNotEmpty,
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
	@IsNotEmpty()
	@Length(5, 50)
	@Matches(/^[a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ'’\-]{2,}( [a-zA-Zа-яА-ЯёЁіІїЇєЄґҐ'’\-]{2,})+$/, {
		message:
			'Full name must contain at least two words with only letters, spaces, apostrophes, or dashes',
	})
	fullName: string;

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
	fullName: string;
	username: string;
	email: string;
	password: string;
};
