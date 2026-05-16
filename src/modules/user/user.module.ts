import { Module } from '@nestjs/common';

import { CloudinaryModule } from '@/common/libs/cloudinary/cloudinary.module';
import { PrismaModule } from '@/common/prisma/prisma.module';

import { ChannelModule } from '../channel/channel.module';
import { CookieService } from '../auth/cookie.service';
import { SessionService } from '../auth/sessions/sessions.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CloudflareModule } from '@/common/libs/cloudflare/cloudflare.module';

@Module({
	imports: [PrismaModule, CloudflareModule, ChannelModule],
	controllers: [UserController],
	providers: [UserService, SessionService, CookieService],
	exports: [UserService, SessionService],
})
export class UserModule {}
