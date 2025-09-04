import { Body, Controller, Get, Param, Patch } from '@nestjs/common';

import { Authorization } from '@/common/decorators/auth.decorators';
import { CurrentUser } from '@/common/decorators/user.decorator';

import { MembersService } from '../members/members.service';
import { UpdateSettingsDto } from './dto/update.dto';
import { SettingsService } from './settings.service';

@Authorization()
@Controller('settings')
export class SettingsController {
	constructor(
		private readonly settingsService: SettingsService,
		private readonly memberService: MembersService,
	) {}

	@Get()
	async getSettings(@CurrentUser('id') userId: string, @Param('projectId') projectId: string) {
		return this.settingsService.getByProjectId(projectId);
	}

	@Patch()
	async updateSettings(
		@Param('projectId') projectId: string,
		@CurrentUser('id') userId: string,
		@Body() dto: UpdateSettingsDto,
	) {
		return this.settingsService.update(projectId, dto);
	}
}
