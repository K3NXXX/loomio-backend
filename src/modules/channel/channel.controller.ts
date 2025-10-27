import { Authorization } from '@/common/decorators/auth.decorators';
import { CurrentUser } from '@/common/decorators/user.decorator';
import { RequestWithUser } from '@/common/types/request-with-user.interface';
import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Post,
	Req,
	UploadedFile,
	UploadedFiles,
	UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ChannelService } from './channel.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/edit-channel.dto';

// Опційно: можна винести у окремий файл
const multerOptions = {
	// Зберігаємо у пам'яті (якщо Cloudinary приймає buffer)
	storage: undefined,
	fileFilter: (
		_req: any,
		file: Express.Multer.File,
		cb: (error: any, acceptFile: boolean) => void,
	) => {
		if (!file.mimetype?.startsWith('image/')) {
			return cb(new Error('File must be an image'), false);
		}
		// avatar дозволяємо лише png/gif (дзеркало фронта)
		if (file.fieldname === 'avatar') {
			if (!['image/png', 'image/gif'].includes(file.mimetype)) {
				return cb(new Error('Avatar must be PNG or GIF'), false);
			}
		}
		cb(null, true);
	},
	// Максимальний розмір на рівні Multer (6 MB — під банер)
	limits: { fileSize: 6 * 1024 * 1024 },
};

@Controller('channel')
export class ChannelController {
	constructor(private readonly channelService: ChannelService) {}

	@Authorization()
	@UseInterceptors(FileInterceptor('avatar'))
	@Post()
	create(
		@Req() req: RequestWithUser,
		@Body() dto: CreateChannelDto,
		@UploadedFile() avatar?: Express.Multer.File,
	) {
		return this.channelService.create(req.user.id, dto, avatar);
	}

	@Authorization()
	@Get('me')
	myChannels(@CurrentUser('id') userId: string) {
		return this.channelService.findUserChannels(userId);
	}

	@Get(':username')
	getByUsername(@Param('username') username: string) {
		return this.channelService.findChannelPublic(username);
	}

	@Authorization()
	@Patch(':id')
	@UseInterceptors(
		FileFieldsInterceptor([
			{ name: 'avatar', maxCount: 1 },
			{ name: 'banner', maxCount: 1 },
		]),
	)
	async update(
		@Param('id') id: string,
		@CurrentUser('id') userId: string,
		@Body() dto: UpdateChannelDto,
		@UploadedFiles()
		files?: {
			avatar?: Express.Multer.File[];
			banner?: Express.Multer.File[];
		},
	) {
		const avatar = files?.avatar?.[0];
		const banner = files?.banner?.[0];
		return this.channelService.update(userId, id, dto, { avatar, banner });
	}

	//   // PUBLIC PROFILE BY USERNAME
	//   @Get('@:username')
	//   getByUsername(@Param('username') username: string) {
	//     return this.channelService.findPublicByUsername(username);
	//   }

	//   // UPDATE
	//   @Authorization()
	//   @Patch(':id')
	//   update(
	//     @Param('id') id: string,
	//     @CurrentUser('id') userId: string,
	//     @Body() dto: UpdateChannelDto,
	//   ) {
	//     return this.channelService.update(userId, id, dto);
	//   }

	//   // SET DEFAULT
	//   @Authorization()
	//   @Patch(':id/default')
	//   setDefault(@Param('id') id: string, @CurrentUser('id') userId: string) {
	//     return this.channelService.setDefault(userId, id);
	//   }

	//   // DELETE
	//   @Authorization()
	//   @Delete(':id')
	//   remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
	//     return this.channelService.delete(userId, id);
	//   }

	//   // FOLLOW / UNFOLLOW CHANNEL
	//   @Authorization()
	//   @Post(':id/follow')
	//   toggleFollow(@Param('id') channelId: string, @CurrentUser('id') userId: string) {
	//     return this.channelService.toggleFollow(userId, channelId);
	//   }

	//   // CHECK IF CURRENT USER FOLLOWS
	//   @Authorization()
	//   @Get(':id/is-following')
	//   isFollowing(@Param('id') channelId: string, @CurrentUser('id') userId: string) {
	//     return this.channelService.isFollowing(userId, channelId);
	//   }

	//   // FOLLOWERS COUNT (public)
	//   @Get(':id/followers/count')
	//   followersCount(@Param('id') channelId: string) {
	//     return this.channelService.followerCount(channelId);
	//   }

	//   // OPTIONAL: channel videos listing with pagination (public)
	//   @Get(':id/videos')
	//   videos(
	//     @Param('id') channelId: string,
	//     @Query('page') page = '1',
	//     @Query('take') take = '12',
	//   ) {
	//     return this.channelService.listVideos(channelId, +page, +take);
	//   }
}
