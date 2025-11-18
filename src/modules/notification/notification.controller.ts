import { Authorization } from '@/common/decorators/auth.decorators';
import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
	constructor(private readonly notificationService: NotificationService) {}

	@Authorization()
	@Get()
	getForUser(@CurrentUser('id') userId: string) {
		return this.notificationService.getUserNotifications(userId);
	}

	@Authorization()
	@Post('/read/channel/:channelId')
	async markChannelRead(@CurrentUser('id') userId: string, @Param('channelId') channelId: string) {
		await this.notificationService.markAllChannelRead(userId, channelId);
		return { success: true };
	}

	@Authorization()
	@Post('/read/personal')
	async markPersonalRead(@CurrentUser('id') userId: string) {
		await this.notificationService.markAllPersonalRead(userId);
		return { success: true };
	}

	@Authorization()
	@Delete('/channel/:channelId')
	async deleteAllForChannel(
		@CurrentUser('id') userId: string,
		@Param('channelId') channelId: string,
	) {
		await this.notificationService.deleteAllChannelNotifications(userId, channelId);
		return { success: true };
	}

	@Authorization()
	@Delete('/personal')
	async deletePersonal(@CurrentUser('id') userId: string) {
		await this.notificationService.deletePersonal(userId);
		return { success: true };
	}
}
