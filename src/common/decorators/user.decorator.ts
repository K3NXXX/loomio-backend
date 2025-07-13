import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { OAuthUser } from '../types/auth.type';

export const CurrentUser = createParamDecorator(
	(data: keyof OAuthUser | undefined, context: ExecutionContext): any => {
		const request = context.switchToHttp().getRequest();
		const user = request.user as OAuthUser;

		if (!user) throw new UnauthorizedException('User is not authenticated');

		return data ? user[data] : user;
	},
);
