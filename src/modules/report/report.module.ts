import { PrismaService } from '@/common/prisma/prisma.service';
import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { CloudinaryModule } from '@/common/libs/cloudinary/cloudinary.module'

@Module({
	imports: [NotificationModule, CloudinaryModule],
	controllers: [ReportController],
	providers: [ReportService, PrismaService],
})
export class ReportModule {}
