import { IsBoolean, IsIn, IsObject, IsOptional } from "class-validator";

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(["list", "board", "calendar"])
  defaultView?: string;

  @IsOptional()
  @IsBoolean()
  notificationsOn?: boolean;

  @IsOptional()
  @IsBoolean()
  archivedVisible?: boolean;

  @IsOptional()
  @IsObject()
  integrationJson?: Record<string, string>;
}
