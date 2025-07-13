import {
	BadRequestException,
	Controller,
	Delete,
	Patch,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Authorization } from 'src/common/decorators/auth.decorators';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
	constructor(private readonly userService: UserService) {}

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
}
