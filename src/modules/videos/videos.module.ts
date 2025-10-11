import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { PrismaModule } from '@/common/prisma/prisma.module'
import { CloudinaryModule } from '@/common/libs/cloudinary/cloudinary.module'
import { PublicVideosController } from './videos-public.controller'

@Module({
	imports: [PrismaModule, CloudinaryModule],
	controllers: [VideosController, PublicVideosController],
	providers: [VideosService],
})
export class VideosModule {}
