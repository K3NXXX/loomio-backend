import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { User } from "@prisma/client";

import { RequestWithUser } from "../types/request-with-user.interface";

export const CurrentUser = createParamDecorator(
  (
    data: keyof User | undefined,
    context: ExecutionContext,
  ): User[keyof User] | User => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) throw new UnauthorizedException("User is not authenticated");

    return data ? user[data] : user;
  },
);
