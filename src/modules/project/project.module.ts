import { Module } from '@nestjs/common';

import { PrismaModule } from '@/common/prisma/prisma.module';

import { InvitesController } from './invites/invite.controller';
import { InviteService } from './invites/invite.service';
import { MembersController } from './members/members.controller';
import { MembersService } from './members/members.service';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { SettingsController } from './settings/settings.controller';
import { SettingsService } from './settings/settings.service';
import { TagsController } from './tags/tags.controller';
import { TagsService } from './tags/tags.service';

@Module({
	imports: [PrismaModule],
	controllers: [
		ProjectController,
		MembersController,
		InvitesController,
		SettingsController,
		TagsController,
	],
	providers: [ProjectService, MembersService, InviteService, SettingsService, TagsService],
	exports: [ProjectService, MembersService, InviteService, SettingsService, TagsService],
})
export class ProjectModule {}
