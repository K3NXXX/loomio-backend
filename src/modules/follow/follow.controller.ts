import { Authorization } from '@/common/decorators/auth.decorators';
import { CurrentUser } from '@/common/decorators/user.decorator';
import { Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { FollowService } from './follow.service';

@Controller('follow')
export class FollowController {
	constructor(private readonly followService: FollowService) {}

	@Authorization()
	@Post(':followingId')
	toggleFollow(@CurrentUser('id') followerId: string, @Param('followingId') followingId: string) {
		return this.followService.toggleFollow(followerId, followingId);
	}

	@Authorization()
	@Get('is-following/:followingId')
	isFollowing(@CurrentUser('id') userId: string, @Param('followingId') followingId: string) {
		return this.followService.isFollowing(userId, followingId);
	}

	@Authorization()
	@Patch(':channelId/notifications')
	toggleNotifications(@CurrentUser('id') userId: string, @Param('channelId') channelId: string) {
		return this.followService.toggleNotifications(userId, channelId);
	}

	@Authorization()
	@Get(':channelId/notifications')
	async isChannelNotificationsEnabled(
		@CurrentUser('id') userId: string,
		@Param('channelId') channelId: string,
	) {
		return this.followService.isNotificationsEnabled(userId, channelId);
	}
}
