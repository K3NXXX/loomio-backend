import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UserDto {
	@IsString()
	@IsNotEmpty()
	firstName: string | null;

	@IsString()
	@IsNotEmpty()
	lastName: string | null;

	@IsString()
	@IsNotEmpty()
	@IsEmail()
	email: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(8, { message: 'Password must be at least 8 characters' })
	password: string | null;

	@IsString()
	avatarUrl?: string | null;
}
