import { Inject, Injectable } from '@nestjs/common';
import { render } from '@react-email/components';
import * as nodemailer from 'nodemailer';
import { VerificationTemplate } from './templates/verification.template';

@Injectable()
export class MailService {
	constructor(
		@Inject('MAIL_TRANSPORTER')
		private readonly transporter: nodemailer.Transporter,
	) {}

	public async sendVerificationCode(email: string, code: string) {
		const html = await render(VerificationTemplate(code));
		return this.sendMail(email, 'Email Verification', html);
	}

	private sendMail(email: string, subject: string, html: string) {
		return this.transporter.sendMail({
			to: email,
			subject,
			html,
		});
	}
}
