import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { VideosModule } from './modules/videos/videos.module'

@Module({
	imports: [ConfigModule.forRoot({ isGlobal: true }), UserModule, AuthModule, AccountModule, VideosModule],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
