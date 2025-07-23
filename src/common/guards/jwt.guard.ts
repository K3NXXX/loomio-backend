import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
	getRequest(context: ExecutionContext) {
		const ctx = context.switchToHttp();
		const request = ctx.getRequest();

		const token = request.cookies?.accessToken;
		if (token) request.headers.authorization = `Bearer ${token}`;

		return request;
	}
}
