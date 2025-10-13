import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { FollowModule } from './modules/follow/follow.module';
import { LikeModule } from './modules/like/like.module';
import { UserModule } from './modules/user/user.module';
import { VideosModule } from './modules/videos/videos.module';

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		UserModule,
		AuthModule,
		AccountModule,
		VideosModule,
		FollowModule,
		LikeModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
