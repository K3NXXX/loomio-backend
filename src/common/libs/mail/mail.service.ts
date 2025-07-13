import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/components';
import * as nodemailer from 'nodemailer';
import { VerificationTemplate } from './templates/verification.template';

@Injectable()
export class MailService {
	private transporter: nodemailer.Transporter;

	constructor(private readonly configService: ConfigService) {
		this.transporter = nodemailer.createTransport({
			service: this.configService.get<string>('EMAIL_SERVICE'),
			auth: {
				user: this.configService.get<string>('EMAIL_USER'),
				pass: this.configService.get<string>('EMAIL_PASS'),
			},
		});
	}

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
