import { PrismaModule } from '@/common/prisma/prisma.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Module } from '@nestjs/common';
import { PlaylistController } from './playlist.controller';
import { PlaylistService } from './playlist.service';

@Module({
	imports: [PrismaModule],
	controllers: [PlaylistController],
	providers: [PlaylistService, PrismaService],
	exports: [PlaylistService],
})
export class PlaylistModule {}
