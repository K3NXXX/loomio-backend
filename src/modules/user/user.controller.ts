import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '@prisma/client';
import { Authorization } from 'src/common/decorators/auth.decorators';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { UserSessionService } from '../auth/sessions/user-sessions.service';
import { AcceptInviteDto } from '../project/invites/dto/accept-ivite.dto';
import { InviteService } from '../project/invites/invite.service';
import { UserService } from './user.service';

@Authorization()
@Controller('user')
export class UserController {
	constructor(
		private readonly userService: UserService,
		private readonly userSessionService: UserSessionService,
		private readonly inviteService: InviteService,
	) {}

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

	@Delete('delete/avatar')
	async deleteAvatar(@CurrentUser('id') userId: string) {
		return this.userService.deleteAvatar(userId);
	}

	@Get('sessions')
	async getSessions(@CurrentUser('id') userId: string) {
		const sessions = await this.userSessionService.findUserSessions(userId);
		return { sessions };
	}

	@Get('invites')
	async getMyInvites(@CurrentUser() user: User) {
		return this.inviteService.findUserInvites(user.id, user.email);
	}

	@Post('invites/accept')
	async acceptInvite(@CurrentUser('id') userId: string, @Body() dto: AcceptInviteDto) {
		return this.inviteService.acceptInvite(userId, dto);
	}

	@Delete('sessions/:id')
	async deleteSession(@CurrentUser('id') userId: string, @Param('id') id: string) {
		await this.userSessionService.deleteSession(userId, id);
		return { message: 'Session deleted' };
	}
}
