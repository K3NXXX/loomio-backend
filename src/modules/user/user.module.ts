import { Module } from '@nestjs/common';
import { CloudinaryModule } from 'src/common/libs/cloudinary/cloudinary.module';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { UserSessionService } from '../auth/sessions/user-sessions.service';
import { ProjectModule } from '../project/project.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
	imports: [CloudinaryModule, PrismaModule, ProjectModule],
	controllers: [UserController],
	providers: [UserService, UserSessionService],
	exports: [UserService, UserSessionService],
})
export class UserModule {}
