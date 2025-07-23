import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { InvitesController } from './invites/invites.controller';
import { InvitesService } from './invites/invites.service';
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
	providers: [ProjectService, MembersService, InvitesService, SettingsService, TagsService],
	exports: [ProjectService],
})
export class ProjectModule {}
