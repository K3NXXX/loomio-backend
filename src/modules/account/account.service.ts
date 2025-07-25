import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class AccountService {
	constructor(private prisma: PrismaService) {}

	async findAccount(provider: string, providerId: string) {
		return this.prisma.account.findUnique({
			where: {
				provider_providerId: { provider, providerId },
			},
			include: { user: true },
		});
	}

	async create(data: { provider: string; providerId: string; userId: string }) {
		const exists = await this.findAccount(data.provider, data.providerId);
		if (exists) throw new ConflictException('OAuth account already exists');

		return this.prisma.account.create({ data });
	}
}
