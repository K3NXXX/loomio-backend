import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import type express from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const config = app.get(ConfigService);

	const expressApp = app.getHttpAdapter().getInstance() as express.Application;
	expressApp.set('trust proxy', 1);

	app.use(helmet());
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

	

	await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();
