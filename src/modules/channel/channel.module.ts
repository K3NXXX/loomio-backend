import { CloudinaryModule } from '@/common/libs/cloudinary/cloudinary.module';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Module } from '@nestjs/common';
import { ChannelController } from './channel.controller';
import { ChannelService } from './channel.service';
import { CloudflareModule } from '@/common/libs/cloudflare/cloudflare.module';

@Module({
	imports: [CloudinaryModule, PrismaModule, CloudflareModule],
	controllers: [ChannelController],
	providers: [ChannelService, PrismaService],
	exports: [ChannelService],
})
export class ChannelModule {}
