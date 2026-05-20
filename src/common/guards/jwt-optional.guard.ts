import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class JwtOptionalGuard extends AuthGuard('jwt') {
	getRequest(context: ExecutionContext) {
		const req = context.switchToHttp().getRequest<Request>();
		const token = (req as any).cookies?.accessToken;
		if (token && !req.headers.authorization) {
			req.headers.authorization = `Bearer ${token}`;
		}
		return req;
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		try {
			const result = await super.canActivate(context);
			return result as boolean;
		} catch {
			return true;
		}
	}

	handleRequest(err: any, user: any) {
		if (err || !user) {
			return null;
		}
		return user;
	}
}
