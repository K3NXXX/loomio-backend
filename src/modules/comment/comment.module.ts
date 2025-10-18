import { Module } from '@nestjs/common';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { PrismaService } from '@/common/prisma/prisma.service'

@Module({
	controllers: [CommentController],
	providers: [CommentService, PrismaService],
	exports: [CommentService],
})
export class CommentModule {}
