import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VideosService } from './videos.service';

import { CurrentUser } from '@/common/decorators/user.decorator';
import { Body, Controller, Get, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { Authorization } from '@/common/decorators/auth.decorators'

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



	// @Patch(':id')
	// update(@Param('id') id: string, @Body() updateVideoDto: UpdateVideoDto) {
	// 	return this.videosService.update(+id, updateVideoDto);
	// }

	// @Delete(':id')
	// remove(@Param('id') id: string) {
	// 	return this.videosService.remove(+id);
	// }
}
