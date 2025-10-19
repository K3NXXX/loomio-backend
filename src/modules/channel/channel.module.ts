import { CloudinaryModule } from '@/common/libs/cloudinary/cloudinary.module';
import { PrismaModule } from '@/common/prisma/prisma.module';
import { PrismaService } from '@/common/prisma/prisma.service';
import { Module } from '@nestjs/common';
import { ChannelController } from './channel.controller';
import { ChannelService } from './channel.service';

@Module({
	imports: [CloudinaryModule, PrismaModule],
	controllers: [ChannelController],
	providers: [ChannelService, PrismaService],
	exports: [ChannelService],
})
export class ChannelModule {}
