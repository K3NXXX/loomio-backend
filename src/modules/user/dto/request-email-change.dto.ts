import { IsEmail, MaxLength } from 'class-validator'

export class RequestEmailChangeDto {
    @IsEmail()
    @MaxLength(100)
    email: string
}
