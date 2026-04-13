import { ConfigService } from '@nestjs/config';

export const CloudflareProvider = {
	provide: 'CLOUDFLARE',
	useFactory: (configService: ConfigService) => ({
		accountId: configService.get('CF_ACCOUNT_ID'),
		apiToken: configService.get('CF_API_TOKEN'),
		accountHash: configService.get('CF_ACCOUNT_HASH'),
	}),
	inject: [ConfigService],
};
