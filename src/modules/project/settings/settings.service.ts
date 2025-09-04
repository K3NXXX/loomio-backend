import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/common/prisma/prisma.service';

import { UpdateSettingsDto } from './dto/update.dto';

@Injectable()
export class SettingsService {
	constructor(private readonly prisma: PrismaService) {}

	async getByProjectId(projectId: string) {
		return this.prisma.projectSettings.findUnique({ where: { projectId } });
	}

	async update(projectId: string, dto: UpdateSettingsDto) {
		return this.prisma.projectSettings.update({
			where: { projectId },
			data: dto,
		});
	}
}
