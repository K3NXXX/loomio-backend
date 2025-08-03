import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { jwtConfig } from "@/common/configs/jwt.config";
import { CloudinaryModule } from "@/common/libs/cloudinary/cloudinary.module";
import { PrismaModule } from "@/common/prisma/prisma.module";
import { GithubStrategy } from "@/common/strategies/github.strategy";
import { GoogleStrategy } from "@/common/strategies/google.strategy";
import { JwtStrategy } from "@/common/strategies/jwt.strategy";

import { AccountModule } from "../account/account.module";
import { PasswordResetModule } from "../email/password-reset/password-reset.module";
import { VerificationModule } from "../email/verification/verification.module";
import { UserModule } from "../user/user.module";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CookieService } from "./cookie.service";
import { SessionService } from "./sessions/sessions.service";
import { TokenService } from "./token.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: jwtConfig,
    }),
    PassportModule.register({ session: false }),
    CloudinaryModule,
    VerificationModule,
    PasswordResetModule,
    UserModule,
    AccountModule,
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    GithubStrategy,
    SessionService,
    TokenService,
    CookieService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
