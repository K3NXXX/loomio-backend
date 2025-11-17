import { Authorization } from '@/common/decorators/auth.decorators';
import { Controller, Delete, Get, Param } from '@nestjs/common';
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
	@Get('/read')
	async markAllAsRead(@CurrentUser('id') userId: string) {
		await this.notificationService.markAllAsRead(userId);
		return { success: true };
	}

	@Authorization()
	@Get('/:id/read')
	async markAsRead(@Param('id') notificationId: string) {
		await this.notificationService.markAsRead(notificationId);
		return { success: true };
	}

	@Authorization()
	@Delete('/channel/:channelId')
	async deleteAllForChannel(
		@CurrentUser('id') userId: string,
		@Param('channelId') channelId: string,
	) {
		await this.notificationService.deleteAll(userId, channelId);
		return { success: true };
	}
}
