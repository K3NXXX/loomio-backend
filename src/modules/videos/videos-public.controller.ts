import { Controller, Get, Param } from '@nestjs/common'
import { VideosService } from './videos.service'


@Controller('videos/public')
export class PublicVideosController {
	constructor(private readonly videosService: VideosService) {}

	@Get()
	findAll() {
		return this.videosService.findAll();
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.videosService.findOne(id);
	}
}
