import { AppearanceMode } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateAppearanceDto {
	@IsEnum(AppearanceMode)
	appearance: AppearanceMode;
}
