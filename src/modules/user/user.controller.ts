import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	Res,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '@prisma/client';
import { Response } from 'express';
import { Authorization } from 'src/common/decorators/auth.decorators';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { CookieService } from '../auth/cookie.service';
import { SessionService } from '../auth/sessions/sessions.service';
import { InviteService } from '../project/invites/invite.service';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateThemeDto } from './dto/theme.dto';
import { UserService } from './user.service';

@Authorization()
@Controller('user')
export class UserController {
	constructor(
		private readonly userService: UserService,
		private readonly sessionService: SessionService,
		private readonly inviteService: InviteService,
		private readonly cookieService: CookieService,
	) {}

	@Get()
	async getUser(@CurrentUser('id') userId: string) {
		return this.userService.getAuthUser(userId);
	}

	@Get('search')
	async searchUsers(@Query() dto: SearchUsersDto) {
		return this.userService.searchUsers(dto);
	}

	@Get('sessions')
	async getSessions(@CurrentUser('id') userId: string) {
		const sessions = await this.sessionService.findUserSessions(userId);
		return { sessions };
	}

	@Delete('sessions/:id')
	async deleteSession(@CurrentUser('id') userId: string, @Param('id') id: string) {
		await this.sessionService.delete(userId, id);
		return { message: 'Session deleted' };
	}

	@Get('invites')
	async getMyInvites(@CurrentUser() user: User) {
		return this.inviteService.findUserInvites(user.id, user.email);
	}

	@Post('invites/:inviteToken/accept')
	async acceptInvite(@CurrentUser('id') userId: string, @Param('inviteToken') token: string) {
		return this.inviteService.acceptInvite(userId, token);
	}

	@Patch('invites/:inviteId/decline')
	async declineInvite(@CurrentUser('id') userId: string, @Param('inviteId') inviteId: string) {
		return this.inviteService.declineInvite(userId, inviteId);
	}

	@Patch('theme')
	async updateTheme(
		@CurrentUser('id') userId: string,
		@Body() dto: UpdateThemeDto,
		@Res() res: Response,
	) {
		const user = await this.userService.updateTheme(userId, dto);

		this.cookieService.setThemeCookie(res, user.theme);

		res.json({ message: 'Theme updated', theme: user.theme });
	}

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
}
