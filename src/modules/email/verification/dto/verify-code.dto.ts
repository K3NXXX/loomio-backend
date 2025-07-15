import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyCodeDto {
	@IsString()
	@IsNotEmpty()
	code: string;
}
