import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CloudflareProvider } from './cloudflare.provider';
import { CloudflareImagesService } from './cloudflare-images.service';
import { CloudflareStreamService } from './cloudflare-stream.service';

@Module({
	imports: [ConfigModule],
	providers: [CloudflareProvider, CloudflareImagesService, CloudflareStreamService],
	exports: [CloudflareImagesService, CloudflareStreamService],
})
export class CloudflareModule {}
