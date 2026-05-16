import { Authorization } from '@/common/decorators/auth.decorators';
import { CurrentUser } from '@/common/decorators/user.decorator';
import { RequestWithUser } from '@/common/types/request-with-user.interface';
import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	Req,
	UploadedFile,
	UploadedFiles,
	UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ChannelService } from './channel.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/edit-channel.dto';

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

	@Get(':username/views')
	async getChannelTotalViews(@Param('username') username: string) {
		return this.channelService.getChannelTotalViews(username);
	}

	@Get(':username')
	getByUsername(
		@Param('username') username: string,
		@Query('scope') scope?: string,
	) {
		const mode = scope === 'studio' ? 'studio' : 'full';
		return this.channelService.findChannel(username, mode);
	}

	@Authorization()
	@Patch(':id')
	@UseInterceptors(
		FileFieldsInterceptor(
			[
				{ name: 'avatar', maxCount: 1 },
				{ name: 'banner', maxCount: 1 },
			],
			{ limits: { fileSize: 15 * 1024 * 1024 } },
		),
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

	@Authorization()
	@Delete(':id')
	deleteChannel(@Param('id') id: string, @CurrentUser('id') userId: string) {
		return this.channelService.delete(userId, id);
	}
}
