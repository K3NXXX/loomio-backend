import { IsEmail, IsNotEmpty, IsString, MinLength, Validate } from 'class-validator';
import { IsPasswordsMatch } from '../../../common/decorators/is-pwds-match.decorator';

export class SignupDto {
	@IsString()
	@IsNotEmpty()
	firstName: string;

	@IsString()
	@IsNotEmpty()
	lastName: string;

	@IsString()
	@IsNotEmpty()
	@IsEmail()
	email: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(8, { message: 'Password must be at least 8 characters' })
	password: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(8, {
		message: 'The password for confirmation must be at least 8 characters',
	})
	@Validate(IsPasswordsMatch)
	confirmPassword: string;
}

export class LoginDto {
	@IsString()
	@IsNotEmpty()
	@IsEmail()
	email: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(8, { message: 'Password must be at least 8 characters' })
	password: string;
}

export type SignupMeta = {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
};

export class VerifyCodeDto {
	@IsString()
	@IsNotEmpty()
	code: string;
}

export class ResendCodeDto {
	@IsString()
	@IsNotEmpty()
	email: string;
}
