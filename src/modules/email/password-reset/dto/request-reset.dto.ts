import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class RequestResetDto {
  @IsEmail()
  @IsString()
  @IsNotEmpty()
  email: string;
}
