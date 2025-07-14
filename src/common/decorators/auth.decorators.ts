import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { RoleGuard } from '../guards/role.guard';
import { Role } from './role.decorator';

export function Authorization(...role: UserRole[]) {
	if (role.length > 0)
		return applyDecorators(Role(...role), UseGuards(AuthGuard('jwt'), RoleGuard));

	return UseGuards(AuthGuard('jwt'));
}

export function GoogleAuthorization() {
	return UseGuards(AuthGuard('google'));
}

export function GitHubAuthorization() {
	return UseGuards(AuthGuard('github'));
}
