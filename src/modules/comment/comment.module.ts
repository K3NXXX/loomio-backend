import { PrismaService } from '@/common/prisma/prisma.service';
import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { NotificationModule } from '../notification/notification.module'

@Module({
	imports: [NotificationModule],
	controllers: [CommentController],
	providers: [CommentService, PrismaService],
	exports: [CommentService],
})
export class CommentModule {}
