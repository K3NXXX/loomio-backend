import { PrismaService } from '@/common/prisma/prisma.service';
import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { LikeController } from './like.controller';
import { LikeService } from './like.service';

@Module({
	imports: [NotificationModule],
	controllers: [LikeController],
	providers: [LikeService, PrismaService],
	exports: [LikeService],
})
export class LikeModule {}
