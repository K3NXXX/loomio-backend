import { Module } from "@nestjs/common";

import { CloudinaryModule } from "@/common/libs/cloudinary/cloudinary.module";
import { MailModule } from "@/common/libs/mail/mail.module";
import { PrismaModule } from "@/common/prisma/prisma.module";
import { UserModule } from "@/modules/user/user.module";

import { VerificationService } from "./verification.service";

@Module({
  imports: [MailModule, CloudinaryModule, PrismaModule, UserModule],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
