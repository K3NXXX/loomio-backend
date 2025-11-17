import { CloudinaryModule } from '@/common/libs/cloudinary/cloudinary.module';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { PublicVideosController } from './videos-public.controller';
import { VideosController } from './videos.controller';
import { VideoScheduler } from './videos.scheduler';
import { VideosService } from './videos.service';

@Module({
	imports: [PrismaModule, CloudinaryModule, NotificationModule],
	controllers: [VideosController, PublicVideosController],
	providers: [VideosService, VideoScheduler],
})
export class VideosModule {}
