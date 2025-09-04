import { IsNotEmpty, IsString, MinLength, Validate } from 'class-validator';

import { IsPasswordsMatch } from '@/common/decorators/is-pwds-match.decorator';

export class PasswordResetDto {
	@IsString()
	@IsNotEmpty()
	token: string;

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
