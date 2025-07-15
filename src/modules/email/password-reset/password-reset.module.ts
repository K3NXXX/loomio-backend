import { Module } from '@nestjs/common';
import { CloudinaryModule } from 'src/common/libs/cloudinary/cloudinary.module';
import { MailModule } from 'src/common/libs/mail/mail.module';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { UserModule } from 'src/modules/user/user.module';
import { PasswordResetService } from './password-reset.service';

@Module({
	imports: [MailModule, CloudinaryModule, PrismaModule, UserModule],
	providers: [PasswordResetService],
	exports: [PasswordResetService],
})
export class PasswordResetModule {}
