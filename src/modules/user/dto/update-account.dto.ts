import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const trimTransform = ({ value }: { value: unknown }): string | undefined =>
	typeof value === 'string' ? value.trim() : undefined;

export class UpdateAccountDto {
	@IsOptional()
	@Transform(trimTransform)
	@Matches(/^[A-Za-zА-Яа-яЁёІіЇїЄєҐґ'’-]+ [A-Za-zА-Яа-яЁёІіЇїЄєҐґ'’-]+$/, {
		message: 'Name must contain exactly two words with only letters',
	})
	@MaxLength(100, { message: 'Name must be less than 100 characters' })
	name?: string;

	@IsOptional()
	@Transform(trimTransform)
	@IsEmail({}, { message: 'Incorrect email' })
	@MaxLength(100, { message: 'Email requires max 100 characters' })
	email?: string;

	@IsOptional()
	@Transform(trimTransform)
	@MaxLength(500, { message: 'Bio must be less than 500 characters' })
	bio?: string;

	@IsOptional()
	@Transform(trimTransform)
	@MinLength(3, { message: 'Username must be at least 3 characters' })
	username?: string;

	@IsOptional()
	@Transform(trimTransform)
	@MinLength(10, { message: 'Password requires min 10 characters' })
	@Matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).+$/, {
		message:
			'Password must contain at least one latin letter, one digit, and one special character',
	})
	newPassword?: string;

	@IsOptional()
	@Transform(trimTransform)
	currentPassword?: string;
}
