import { Authorization } from '@/common/decorators/auth.decorators';
import { CurrentUser } from '@/common/decorators/user.decorator';
import { Controller, Get, Param, Post } from '@nestjs/common';
import { LikeService } from './like.service';

@Controller('likes')
export class LikeController {
	constructor(private readonly likeService: LikeService) {}

	@Authorization()
	@Post('video/:videoId/like')
	async likeVideo(@Param('videoId') videoId: string, @CurrentUser('id') userId: string) {
		return this.likeService.toggleVideoLike(videoId, userId);
	}

	@Authorization()
	@Post('video/:videoId/dislike')
	async dislikeVideo(@Param('videoId') videoId: string, @CurrentUser('id') userId: string) {
		return this.likeService.toggleVideoDislike(videoId, userId);
	}

	@Authorization()
	@Get('video/:videoId/has-liked')
	async hasLikedVideo(@Param('videoId') videoId: string, @CurrentUser('id') userId: string) {
		const liked = await this.likeService.hasLikedVideo(userId, videoId);
		return { liked };
	}

	@Authorization()
	@Get('video/:videoId/has-disliked')
	async hasDisliked(@Param('videoId') videoId: string, @CurrentUser('id') userId: string) {
		const disliked = await this.likeService.hasDislikedVideo(userId, videoId);
		return { disliked };
	}
}
