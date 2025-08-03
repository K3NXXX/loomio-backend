import { Module } from "@nestjs/common";

import { CloudinaryModule } from "@/common/libs/cloudinary/cloudinary.module";
import { PrismaModule } from "@/common/prisma/prisma.module";

import { CookieService } from "../auth/cookie.service";
import { SessionService } from "../auth/sessions/sessions.service";
import { ProjectModule } from "../project/project.module";

import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [CloudinaryModule, PrismaModule, ProjectModule],
  controllers: [UserController],
  providers: [UserService, SessionService, CookieService],
  exports: [UserService, SessionService],
})
export class UserModule {}
