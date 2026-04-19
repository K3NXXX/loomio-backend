import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Query,
	Res,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { Authorization } from '@/common/decorators/auth.decorators';
import { CurrentUser } from '@/common/decorators/user.decorator';

import { CookieService } from '../auth/cookie.service';
import { SessionService } from '../auth/sessions/sessions.service';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateThemeDto } from './dto/theme.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { UserService } from './user.service';
import { UpdateLocaleDto } from './dto/update-locale.dto';

@Authorization()
@Controller('user')
export class UserController {
	constructor(
		private readonly userService: UserService,
		private readonly sessionService: SessionService,
		private readonly cookieService: CookieService,
	) {}

	@Get()
	async getUser(@CurrentUser('id') userId: string) {
		return this.userService.getAuthUser(userId);
	}

	@Get('search')
	async searchUsers(@CurrentUser('id') userId: string, @Query() dto: SearchUsersDto) {
		return this.userService.searchUsers(userId, dto);
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

	@Patch('locale')
	async updateLocale(
		@CurrentUser('id') userId: string,
		@Body() dto: UpdateLocaleDto,
		@Res() res: Response,
	) {
		const user = await this.userService.updateLocale(userId, dto.locale);

		this.cookieService.setPreferenceCookie(res, 'locale', user.locale.toLowerCase());

		res.json({ message: 'Locale updated', locale: user.locale });
	}

	@Patch('update')
	async updateAccount(@CurrentUser('id') userId: string, @Body() dto: UpdateAccountDto) {
		return this.userService.updateAccount(userId, dto);
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

	@Get('following')
	getFollowedChannels(@CurrentUser('id') userId: string) {
		return this.userService.getFollowedChannels(userId);
	}
}
