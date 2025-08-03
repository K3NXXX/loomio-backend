import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import { RequestWithCookies } from "../types/request-with-cookies.interface";

@Injectable()
export class JwtGuard extends AuthGuard("jwt") {
  getRequest(context: ExecutionContext): RequestWithCookies {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<RequestWithCookies>();

    const token = request.cookies?.accessToken;
    if (token) request.headers.authorization = `Bearer ${token}`;

    return request;
  }
}
