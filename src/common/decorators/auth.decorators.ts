import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";

import { JwtGuard } from "../guards/jwt.guard";
import { RoleGuard } from "../guards/role.guard";

import { Role } from "./role.decorator";

export function Authorization(...role: UserRole[]) {
  if (role.length > 0)
    return applyDecorators(Role(...role), UseGuards(JwtGuard, RoleGuard));

  return UseGuards(JwtGuard);
}

export function GoogleAuthorization() {
  return UseGuards(AuthGuard("google"));
}

export function GitHubAuthorization() {
  return UseGuards(AuthGuard("github"));
}
