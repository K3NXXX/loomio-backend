import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { VideosService } from './videos.service';
import { JwtOptionalGuard } from '@/common/guards/jwt-optional.guard';
import { OptionalCurrentUser } from '@/common/decorators/optional-user.decorator';
import { PublicVideosQueryDto } from './dto/public-videos-query.dto';

@Controller('videos/public')
export class PublicVideosController {
	constructor(private readonly videosService: VideosService) {}

	@Get()
	@UseGuards(JwtOptionalGuard)
	findAll(
		@OptionalCurrentUser('id') viewerUserId: string | undefined,
		@Query() query: PublicVideosQueryDto,
	) {
		return this.videosService.findAll(viewerUserId ?? null, query);
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.videosService.findOne(id);
	}

	@Get(':id/recommended')
	getRecommended(@Param('id') id: string) {
		return this.videosService.getRecommended(id);
	}
}
