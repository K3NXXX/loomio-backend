import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/components';
import * as nodemailer from 'nodemailer';
import { SentMessageInfo } from 'nodemailer';

import { PasswordResetTemplate } from './templates/password-reset.template';
import { VerificationTemplate } from './templates/verification.template';

@Injectable()
export class MailService {
	constructor(
		@Inject('MAIL_TRANSPORTER')
		private readonly transporter: nodemailer.Transporter,
		private readonly configService: ConfigService,
	) {}

	async sendVerificationCode(email: string, code: string): Promise<SentMessageInfo> {
		const html = await render(VerificationTemplate(code));
		return this.sendMail(email, 'Email Verification', html);
	}

	async sendPasswordResetToken(email: string, token: string): Promise<SentMessageInfo> {
		const domain = this.configService.getOrThrow<string>('CLIENT_URL');
		const html = await render(PasswordResetTemplate(token, domain));
		return this.sendMail(email, 'Password reset Loomio', html);
	}

	private sendMail(email: string, subject: string, html: string) {
		return this.transporter.sendMail({
			to: email,
			subject,
			html,
		});
	}
}
