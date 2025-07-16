import { IsNotEmpty, IsString, MinLength, Validate } from 'class-validator';
import { IsPasswordsMatch } from 'src/common/decorators/is-pwds-match.decorator';

export class PasswordResetDto {
	@IsString()
	@IsNotEmpty()
	token: string;

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
