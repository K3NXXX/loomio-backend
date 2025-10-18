import { Authorization } from '@/common/decorators/auth.decorators';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { CommentService } from './comment.service';
import { CommentReactionDto } from './dto/comment-reaction.dto';
import { CommentDto, UpdateCommentDto } from './dto/comment.dto';

@Controller('comments')
export class CommentController {
	constructor(private readonly commentService: CommentService) {}

	@Authorization()
	@Post()
	createComment(@CurrentUser('id') userId: string, @Body() dto: CommentDto) {
		return this.commentService.create(userId, dto);
	}

	@Authorization()
	@Get('video/:videoId')
	findAllForPost(
		@Param('videoId') videoId: string,
		@CurrentUser('id') userId: string,
		@Query('page') page = '1',
		@Query('take') take = '15',
	) {
		return this.commentService.findAllForPost(videoId, userId, +page, +take);
	}

	// @Authorization()
	// @Get(':id/replies')
	// findReplies(
	// 	@Param('id') id: string,
	// 	@CurrentUser('id') userId: string,
	// 	@Query('page') page = '1',
	// 	@Query('take') take = '5',
	// ) {
	// 	return this.commentService.findReplies(id, userId, +page, +take);
	// }

	// @Authorization()
	// @Get(':id')
	// findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
	// 	return this.commentService.findOne(id, userId);
	// }

	@Authorization()
	@Patch(':id')
	update(
		@Param('id') id: string,
		@CurrentUser('id') userId: string,
		@Body() dto: UpdateCommentDto,
	) {
		return this.commentService.update(id, userId, dto.content as string);
	}

	@Authorization()
	@Post('reaction/:commentId')
	react(
		@CurrentUser('id') userId: string,
		@Param('commentId') commentId: string,
		@Body() dto: CommentReactionDto,
	) {
		return this.commentService.reactToComment(userId, commentId, dto);
	}

	@Authorization()
	@Delete(':id')
	remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
		return this.commentService.remove(id, userId);
	}
}
