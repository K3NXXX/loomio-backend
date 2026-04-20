import { PrismaModule } from '@/common/prisma/prisma.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Module } from '@nestjs/common';
import { PlaylistController } from './playlist.controller';
import { PlaylistService } from './playlist.service';
import { CloudflareModule } from '@/common/libs/cloudflare/cloudflare.module';

@Module({
	imports: [PrismaModule, CloudflareModule],
	controllers: [PlaylistController],
	providers: [PlaylistService, PrismaService],
	exports: [PlaylistService],
})
export class PlaylistModule {}
