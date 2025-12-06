import { Role } from '@/common/decorators/role.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import { JwtGuard } from '@/common/guards/jwt.guard';
import { RoleGuard } from '@/common/guards/role.guard';
import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	UploadedFiles,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
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

	@Get('stats')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	getStats() {
		return this.reportService.getStats();
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

	@Post('report-video/:id')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	reportVideo(@Param('id') id: string, @CurrentUser('id') userId: string) {
		return this.reportService.reportVideo(id, userId);
	}

	@Post('review/:videoId')
	@UseGuards(JwtGuard)
	@UseInterceptors(
		FileFieldsInterceptor([
			{ name: 'video', maxCount: 1 },
			{ name: 'thumbnail', maxCount: 1 },
		]),
	)
	requestReview(
		@Param('videoId') id: string,
		@Body() dto,
		@UploadedFiles()
		files: {
			video?: Express.Multer.File[];
			thumbnail?: Express.Multer.File[];
		},
		@CurrentUser('id') userId: string,
	) {
		return this.reportService.requestReviewUpload(id, dto, files, userId);
	}

	@Post('confirm-video/:id')
	@Role(UserRole.ADMIN)
	@UseGuards(JwtGuard, RoleGuard)
	confirmVideoReview(@Param('id') reportId: string, @CurrentUser('id') moderatorId: string) {
		return this.reportService.confirmReviewVideo(reportId, moderatorId);
	}
}
