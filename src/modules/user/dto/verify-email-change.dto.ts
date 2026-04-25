import { IsEmail, IsString, Length } from 'class-validator'

export class VerifyEmailChangeDto {
    @IsEmail()
    email: string

    @IsString()
    @Length(6, 6)
    code: string
}