import { Module } from '@nestjs/common';
import { CloudinaryModule } from 'src/common/libs/cloudinary/cloudinary.module';
import { MailModule } from 'src/common/libs/mail/mail.module';
import { PrismaService } from 'src/common/prisma.service';
import { UserService } from 'src/modules/user/user.service';
import { PasswordResetService } from './password-reset.service';

@Module({
	imports: [MailModule, CloudinaryModule],
	providers: [PasswordResetService, PrismaService, UserService],
	exports: [PasswordResetService],
})
export class PasswordResetModule {}
