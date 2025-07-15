import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { jwtConfig } from 'src/common/configs/jwt.config';
import { CloudinaryModule } from 'src/common/libs/cloudinary/cloudinary.module';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { GithubStrategy } from 'src/common/strategies/github.strategy';
import { GoogleStrategy } from 'src/common/strategies/google.strategy';
import { JwtStrategy } from 'src/common/strategies/jwt.strategy';
import { AccountModule } from '../account/account.module';
import { PasswordResetModule } from '../email/password-reset/password-reset.module';
import { VerificationModule } from '../email/verification/verification.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserSessionService } from './sessions/user-sessions.service';

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
	providers: [AuthService, JwtStrategy, GoogleStrategy, GithubStrategy, UserSessionService],
	exports: [AuthService],
})
export class AuthModule {}
