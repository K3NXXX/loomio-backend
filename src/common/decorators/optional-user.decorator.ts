import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

import { RequestWithOptionalUser } from '../types/request-with-optional-user.interface';

export const OptionalCurrentUser = createParamDecorator(
	(
		data: keyof User | undefined,
		context: ExecutionContext,
	): User | User[keyof User] | undefined => {
		const request = context.switchToHttp().getRequest<RequestWithOptionalUser>();
		const user = request.user;
		if (!user) return undefined;
		return data ? user[data] : user;
	},
);
