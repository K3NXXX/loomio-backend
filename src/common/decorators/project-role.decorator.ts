import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { MemberRole } from '@prisma/client';

import { ProjectRoleGuard } from '../guards/project-role.guard';

export const PROJECT_ROLES_KEY = 'projectRoles';

export function ProjectRoles(...roles: MemberRole[]) {
	return applyDecorators(SetMetadata(PROJECT_ROLES_KEY, roles), UseGuards(ProjectRoleGuard));
}
