import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';

export const CurrentUser = createParamDecorator(
	(data: keyof User | undefined, context: ExecutionContext): any => {
		const request = context.switchToHttp().getRequest();
		const user = request.user as User;

		if (!user) throw new UnauthorizedException('User is not authenticated');

		return data ? user[data] : user;
	},
);
