import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyCodeDto {
	@IsString()
	@IsNotEmpty()
	@Length(6, 6)
	code: string;
}
