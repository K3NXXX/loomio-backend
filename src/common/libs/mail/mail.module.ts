import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailProvider } from './mail.provider';
import { MailService } from './mail.service';

@Module({
	imports: [ConfigModule],
	providers: [MailProvider, MailService],
	exports: [MailService],
})
export class MailModule {}
