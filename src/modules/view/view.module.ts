import { PrismaService } from '@/common/prisma/prisma.service';
import { Module } from '@nestjs/common';
import { ViewController } from './view.controller';
import { ViewService } from './view.service';

@Module({
	controllers: [ViewController],
	providers: [ViewService, PrismaService],
	exports: [ViewService],
})
export class ViewModule {}
