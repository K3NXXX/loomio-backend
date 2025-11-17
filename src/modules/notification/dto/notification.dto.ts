import { NotificationType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateNotificationDto {
	@IsEnum(NotificationType)
	type: NotificationType;

	@IsString()
	@IsNotEmpty()
	message: string;

	@IsString()
	@IsNotEmpty()
	userId: string;

	@IsOptional()
	@IsString()
	authorId: string;

	@IsOptional()
	@IsString()
	channelId?: string;

	@IsOptional()
	@IsString()
	videoId?: string;

	@IsOptional()
	@IsString()
	commentId?: string;
}
