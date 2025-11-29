import { Role } from '@/common/decorators/role.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import { JwtGuard } from '@/common/guards/jwt.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportService } from './report.service';

@Controller('reports')
export class ReportController {
	constructor(private readonly reportService: ReportService) {}

	@Post()
	@UseGuards(JwtGuard)
	create(@CurrentUser('id') userId: string, @Body() dto: CreateReportDto) {
		return this.reportService.create(userId, dto);
	}

	@Get()
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	getAll() {
		return this.reportService.getAll();
	}

	@Delete(':id')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	delete(@Param('id') id: string) {
		return this.reportService.remove(id);
	}
}
