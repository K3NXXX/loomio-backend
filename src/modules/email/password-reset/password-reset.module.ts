import { Module } from "@nestjs/common";

import { CloudinaryModule } from "@/common/libs/cloudinary/cloudinary.module";
import { MailModule } from "@/common/libs/mail/mail.module";
import { PrismaModule } from "@/common/prisma/prisma.module";
import { UserModule } from "@/modules/user/user.module";

import { PasswordResetService } from "./password-reset.service";

@Module({
  imports: [MailModule, CloudinaryModule, PrismaModule, UserModule],
  providers: [PasswordResetService],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
