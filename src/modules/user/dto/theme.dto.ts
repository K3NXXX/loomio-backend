import { ThemeColors } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UpdateThemeDto {
  @IsEnum(ThemeColors)
  theme: ThemeColors;
}
