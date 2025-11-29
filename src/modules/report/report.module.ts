import { PrismaService } from '@/common/prisma/prisma.service';
import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
	controllers: [ReportController],
	providers: [ReportService, PrismaService],
})
export class ReportModule {}
	 