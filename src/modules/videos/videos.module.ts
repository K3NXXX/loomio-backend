import { CloudinaryModule } from '@/common/libs/cloudinary/cloudinary.module';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { Module } from '@nestjs/common';
import { PublicVideosController } from './videos-public.controller';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { VideoScheduler } from './videos.scheduler'

@Module({
	imports: [PrismaModule, CloudinaryModule],
	controllers: [VideosController, PublicVideosController],
	providers: [VideosService, VideoScheduler],
})
export class VideosModule {}
