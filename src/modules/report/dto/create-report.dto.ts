import { ReportReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReportDto {
  @IsEnum(ReportReason)
  reason: ReportReason;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsUUID()
  videoId?: string;

  @IsOptional()
  @IsUUID()
  commentId?: string;
}
