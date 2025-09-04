import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
	isWorking(): string {
		return 'Server is working...';
	}
}
