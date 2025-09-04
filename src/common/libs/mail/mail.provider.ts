import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export const MailProvider: Provider = {
	provide: 'MAIL_TRANSPORTER',
	inject: [ConfigService],
	useFactory: (configService: ConfigService) => {
		return nodemailer.createTransport({
			from: 'NEXTGEN',
			service: configService.getOrThrow<string>('EMAIL_SERVICE'),
			auth: {
				user: configService.getOrThrow<string>('EMAIL_USER'),
				pass: configService.getOrThrow<string>('EMAIL_PASS'),
			},
		});
	},
};
