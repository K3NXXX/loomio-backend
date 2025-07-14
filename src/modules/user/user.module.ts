import { Module } from '@nestjs/common';
import { CloudinaryModule } from 'src/common/libs/cloudinary/cloudinary.module';
import { PrismaService } from 'src/common/prisma.service';
import { UserSessionService } from '../auth/sessions/user-sessions.service';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
	imports: [CloudinaryModule],
	controllers: [UserController],
	providers: [UserService, PrismaService, UserSessionService],
})
export class UserModule {}
