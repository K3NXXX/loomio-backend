import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/common/prisma/prisma.service';

@Injectable()
export class AccountService {
	constructor(private prisma: PrismaService) {}

	async findAccount(provider: string, providerId: string) {
		return this.prisma.account.findUnique({
			where: {
				provider_providerId: { provider, providerId },
			},
			include: {
				user: true,
			},
		});
	}

	async create(data: { provider: string; providerId: string; userId: string }) {
		return this.prisma.account.create({ data });
	}
}
