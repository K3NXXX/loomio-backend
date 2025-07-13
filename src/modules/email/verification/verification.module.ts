import { Module } from '@nestjs/common';
import { CloudinaryModule } from 'src/common/libs/cloudinary/cloudinary.module';
import { MailModule } from 'src/common/libs/mail/mail.module';
import { PrismaService } from 'src/common/prisma.service';
import { UserService } from 'src/modules/user/user.service';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
	imports: [MailModule, CloudinaryModule],
	controllers: [VerificationController],
	providers: [VerificationService, PrismaService, UserService],
	exports: [VerificationService],
})
export class VerificationModule {}
