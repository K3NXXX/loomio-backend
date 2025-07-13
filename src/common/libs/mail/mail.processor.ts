import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { MailService } from './mail.service';

@Processor('mail')
export class MailProcessor {
	constructor(private readonly mailService: MailService) {}

	@Process('sendVerification')
	async handleSendVerification(job: Job<{ email: string; code: string }>) {
		const { email, code } = job.data;
		await this.mailService.sendVerificationCode(email, code);
	}
}
