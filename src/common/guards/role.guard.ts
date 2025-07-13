import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { KEY } from '../decorators/role.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const role = this.reflector.getAllAndOverride<UserRole[]>(KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		const request = context.switchToHttp().getRequest();

		if (!role) return true;
		if (!role.includes(request.user.role))
			throw new ForbiddenException(
				'You do not have the necessary permissions to access this resource',
			);

		return true;
	}
}
