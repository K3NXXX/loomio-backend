import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyCodeDto {
	@IsString()
	@IsNotEmpty()
	@Length(6, 6)
	@Matches(/^\d+$/)
	code: string;
}
