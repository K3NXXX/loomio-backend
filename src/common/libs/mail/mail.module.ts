import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailProcessor } from './mail.processor';
import { MailService } from './mail.service';

@Module({
	imports: [
		ConfigModule,
		BullModule.registerQueue({
			name: 'mail',
		}),
	],
	providers: [MailService, MailProcessor],
	exports: [MailService, BullModule],
})
export class MailModule {}
