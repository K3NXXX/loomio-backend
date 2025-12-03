import { Role } from '@/common/decorators/role.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import { JwtGuard } from '@/common/guards/jwt.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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

	@Get('videos')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	getVideoReports() {
		return this.reportService.getVideoReports();
	}

	@Get('comments')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	getCommentReports() {
		return this.reportService.getCommentReports();
	}

	@Delete(':id')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	delete(@Param('id') id: string) {
		return this.reportService.remove(id);
	}

	@Get(':id')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	getOne(@Param('id') id: string) {
		return this.reportService.getOne(id);
	}

	@Patch(':id/assign')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	assign(@Param('id') id: string, @CurrentUser('id') moderatorId: string) {
		return this.reportService.assign(id, moderatorId);
	}

	@Post('approve/:id')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	approve(@Param('id') id: string, @CurrentUser('id') userId: string) {
		return this.reportService.approve(id, userId);
	}

	@Post('delete-comment/:id')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	deleteComment(@Param('id') id: string, @CurrentUser('id') userId: string) {
		return this.reportService.deleteComment(id, userId);
	}

	@Get('comments/history')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	getCommentHistory() {
		return this.reportService.getCommentHistory();
	}

	@Get('videos/history')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	getVideoHistory() {
		return this.reportService.getVideoHistory();
	}
}
