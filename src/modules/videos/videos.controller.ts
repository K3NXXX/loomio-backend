import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VideosService } from './videos.service';

import { Authorization } from '@/common/decorators/auth.decorators';
import { CurrentUser } from '@/common/decorators/user.decorator';
import {
	Body,
	Controller,
	Delete,
	Param,
	Patch,
	Post,
	UploadedFiles,
	UseInterceptors,
} from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

@Authorization()
@Controller('videos')
export class VideosController {
	constructor(private readonly videosService: VideosService) {}

	@Post()
	@UseInterceptors(
		FileFieldsInterceptor([
			{ name: 'file', maxCount: 1 },
			{ name: 'thumbnail', maxCount: 1 },
		]),
	)
	create(
		@CurrentUser('id') userId: string,
		@UploadedFiles()
		files: {
			file?: Express.Multer.File[];
			thumbnail?: Express.Multer.File[];
		},
		@Body() createVideoDto: CreateVideoDto,
	) {
		return this.videosService.create(createVideoDto, files, userId);
	}

	@Patch(':id')
	@UseInterceptors(
		FileFieldsInterceptor([
			{ name: 'file', maxCount: 1 },
			{ name: 'thumbnail', maxCount: 1 },
		]),
	)
	update(
		@Param('id') id: string,
		@CurrentUser('id') userId: string,
		@UploadedFiles()
		files: {
			file?: Express.Multer.File[];
			thumbnail?: Express.Multer.File[];
		},
		@Body() updateVideoDto: UpdateVideoDto,
	) {
		return this.videosService.update(id, updateVideoDto, files, userId);
	}

	@Delete(':id')
	remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
		return this.videosService.remove(id, userId);
	}

	@Authorization()
	@Patch(':id/playlist/:playlistId')
	addToPlaylist(
		@CurrentUser('id') userId: string,
		@Param('id') videoId: string,
		@Param('playlistId') playlistId: string,
	) {
		return this.videosService.addToUserPlaylist(userId, videoId, playlistId);
	}
}
