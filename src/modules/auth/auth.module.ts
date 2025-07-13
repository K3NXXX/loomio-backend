import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { jwtConfig } from 'src/common/configs/jwt.config';
import { CloudinaryModule } from 'src/common/libs/cloudinary/cloudinary.module';
import { PrismaService } from 'src/common/prisma.service';
import { FacebookStrategy } from 'src/common/strategies/facebook.strategy';
import { GithubStrategy } from 'src/common/strategies/github.strategy';
import { GoogleStrategy } from 'src/common/strategies/google.strategy';
import { JwtStrategy } from 'src/common/strategies/jwt.strategy';
import { VerificationModule } from '../email/verification/verification.module';
import { UserService } from '../user/user.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

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
	],
	controllers: [AuthController],
	providers: [
		AuthService,
		JwtStrategy,
		GoogleStrategy,
		FacebookStrategy,
		GithubStrategy,
		UserService,
		PrismaService,
	],
})
export class AuthModule {}
