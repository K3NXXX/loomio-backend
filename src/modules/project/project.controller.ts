import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { Authorization } from '@/common/decorators/auth.decorators';
import { CurrentUser } from '@/common/decorators/user.decorator';

import { CreateProjectDto } from './dto/create.dto';
import { UpdateProjectDto } from './dto/update.dto';
import { ProjectService } from './project.service';

@Authorization()
@Controller('projects')
export class ProjectController {
	constructor(private readonly projectService: ProjectService) {}

	@Post()
	create(@CurrentUser('id') ownerId: string, @Body() dto: CreateProjectDto) {
		return this.projectService.create(ownerId, dto);
	}

	@Get()
	findAll(@CurrentUser('id') userId: string) {
		return this.projectService.findAllByUser(userId);
	}

	@Get(':id')
	findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
		return this.projectService.findById(id, userId);
	}

	@Patch(':id')
	update(
		@Param('id') id: string,
		@Body() dto: UpdateProjectDto,
		@CurrentUser('id') userId: string,
	) {
		return this.projectService.update(id, userId, dto);
	}

	@Delete(':id')
	remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
		return this.projectService.remove(id, userId);
	}
}
