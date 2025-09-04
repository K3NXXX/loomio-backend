import {
	BadRequestException,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberRole } from '@prisma/client';

import { PROJECT_ROLES_KEY } from '../decorators/project-role.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RequestWithParams } from '../types/request-with-params.interface';

@Injectable()
export class ProjectRoleGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly prisma: PrismaService,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const requiredRoles = this.reflector.getAllAndOverride<MemberRole[]>(PROJECT_ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!requiredRoles || requiredRoles.length === 0) return true;

		const request = context.switchToHttp().getRequest<RequestWithParams>();
		const userId = request.user?.id;
		const projectId = request.params?.projectId;

		if (!userId || !projectId) throw new BadRequestException('Missing user or project ID');

		const membership = await this.prisma.projectMember.findUnique({
			where: {
				userId_projectId: {
					userId,
					projectId,
				},
			},
		});

		if (!membership) throw new ForbiddenException('You are not a member of this project');
		if (!requiredRoles.includes(membership.role))
			throw new ForbiddenException('Insufficient permissions');

		return true;
	}
}
