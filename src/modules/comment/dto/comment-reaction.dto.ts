import { ReactionType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class CommentReactionDto {
	@IsEnum(ReactionType)
	type: ReactionType;
}
