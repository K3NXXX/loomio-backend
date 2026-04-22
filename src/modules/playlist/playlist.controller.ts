import { Authorization } from '@/common/decorators/auth.decorators';
import { CurrentUser } from '@/common/decorators/user.decorator';
import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	UploadedFiles,
	UseInterceptors,
} from '@nestjs/common';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { PlaylistService } from './playlist.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('playlist')
export class PlaylistController {
	constructor(private readonly playlistService: PlaylistService) {}

	@Authorization()
	@Post()
	@UseInterceptors(FileFieldsInterceptor([{ name: 'cover', maxCount: 1 }]))
	create(
		@CurrentUser('id') userId: string,
		@Body() dto: CreatePlaylistDto,
		@UploadedFiles() files: { cover?: Express.Multer.File[] },
	) {
		return this.playlistService.create(userId, dto, files);
	}

	@Authorization()
	@Get('me')
	getMyPlaylists(@CurrentUser('id') userId: string) {
		return this.playlistService.getUserPlaylists(userId);
	}

	@Authorization()
	@Get('channel-playlist/:playlistId')
	getChannelPlaylistById(
		@CurrentUser('id') userId: string,
		@Param('playlistId') playlistId: string,
	) {
		return this.playlistService.getChannelPlaylistById(userId, playlistId);
	}

	@Get('channel/:channelId')
	getChannelPlaylists(@Param('channelId') channelId: string) {
		return this.playlistService.getChannelPlaylists(channelId);
	}

	@Authorization()
	@Delete(':id')
	delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
		return this.playlistService.delete(userId, id);
	}

	@Authorization()
	@Patch(':id')
	@UseInterceptors(FileFieldsInterceptor([{ name: 'cover', maxCount: 1 }]))
	update(
		@CurrentUser('id') userId: string,
		@Param('id') id: string,
		@Body() dto: UpdatePlaylistDto,
		@UploadedFiles() files?: { cover?: Express.Multer.File[] },
	) {
		return this.playlistService.update(userId, id, dto, files);
	}

	@Authorization()
	@Get(':id')
	getById(@CurrentUser('id') userId: string, @Param('id') id: string) {
		return this.playlistService.getById(userId, id);
	}
}
