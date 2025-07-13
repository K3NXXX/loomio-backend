import { getQueueToken } from '@nestjs/bull';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Queue } from 'bull';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { BullBoardModule } from './common/bull-board.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const config = app.get(ConfigService);

	app.use(cookieParser());

	app.enableCors({
		origin: ['http://localhost:3000'],
		credentials: true,
	});

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			forbidNonWhitelisted: true,
			transform: true,
		}),
	);

	if (config.get('NODE_ENV') === 'development') {
		const mailQueue = app.get<Queue>(getQueueToken('mail'));
		BullBoardModule.setup(app, mailQueue);
	}

	await app.listen(config.getOrThrow<number>('PORT'));
}

bootstrap();
