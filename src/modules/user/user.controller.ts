import {
	BadRequestException,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Authorization } from 'src/common/decorators/auth.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { UserSessionService } from '../auth/sessions/user-sessions.service';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
	constructor(
		private readonly userService: UserService,
		private readonly userSessionService: UserSessionService,
	) {}

	@Authorization()
	@Patch('update/avatar')
	@UseInterceptors(
		FileInterceptor('file', {
			limits: { fileSize: 2 * 1024 * 1024 },
			fileFilter: (req, file, cb) => {
				const allowed = ['image/png', 'image/jpeg', 'image/webp'];
				if (!allowed.includes(file.mimetype)) {
					cb(new BadRequestException('Only .png, .jpg and .webp formats allowed'), false);
				} else {
					cb(null, true);
				}
			},
		}),
	)
	async uploadAvatar(@CurrentUser('id') userId: string, @UploadedFile() file: Express.Multer.File) {
		return this.userService.uploadAvatar(userId, file);
	}

	@Authorization()
	@Delete('delete/avatar')
	async deleteAvatar(@CurrentUser('id') userId: string) {
		return this.userService.deleteAvatar(userId);
	}

	@Authorization()
	@Get('sessions')
	async getSessions(@CurrentUser('id') userId: string) {
		const sessions = await this.userSessionService.findUserSessions(userId);
		return { sessions };
	}

	@Authorization()
	@Delete('sessions/:id')
	async deleteSession(@CurrentUser('id') userId: string, @Param('id') id: string) {
		await this.userSessionService.deleteSession(userId, id);
		return { message: 'Session deleted' };
	}
}
