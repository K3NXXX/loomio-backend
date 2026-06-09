import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { VideosService } from './videos.service';

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
	StreamableFile,
	UploadedFile,
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

	@Get('status/:id')
	getStatus(@Param('id') id: string) {
		return this.videosService.getStatus(id);
	}

	@Get(':id/download')
	async getPremiumDownloadFile(
		@CurrentUser('id') userId: string,
		@Param('id') videoId: string,
	): Promise<StreamableFile> {
		const { stream, contentType, contentDisposition, contentLength } =
			await this.videosService.pipePremiumDownload(userId, videoId);
		return new StreamableFile(stream, {
			type: contentType,
			disposition: contentDisposition,
			...(typeof contentLength === 'number' && contentLength > 0 ? { length: contentLength } : {}),
		});
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

	@Delete('temp/:videoId')
	deleteTemp(@Param('videoId') videoId: string) {
		return this.videosService.deleteTemp(videoId);
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

	@Post('upload-url')
	getUploadUrl() {
		return this.videosService.getUploadUrl();
	}

	@Authorization()
	@Delete(':id/playlist/:playlistId')
	removeFromPlaylist(
		@CurrentUser('id') userId: string,
		@Param('id') videoId: string,
		@Param('playlistId') playlistId: string,
	) {
		return this.videosService.removeFromUserPlaylist(userId, videoId, playlistId);
	}

	@Get('studio/:channelId')
	findAllForStudio(
		@Param('channelId') channelId: string,
		@CurrentUser('id') userId: string,
	) {
		return this.videosService.findAllForChannelStudio(channelId, userId);
	}
}
