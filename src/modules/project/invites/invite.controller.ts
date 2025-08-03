import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { MemberRole } from "@prisma/client";

import { Authorization } from "@/common/decorators/auth.decorators";
import { ProjectRoles } from "@/common/decorators/project-role.decorator";
import { CurrentUser } from "@/common/decorators/user.decorator";

import { CancelInviteDto } from "./dto/cancel-ivite.dto";
import { InviteDto } from "./dto/invite.dto";
import { InviteService } from "./invite.service";

@Authorization()
@Controller("projects/:projectId/invites")
export class InvitesController {
  constructor(private readonly inviteService: InviteService) {}

  @ProjectRoles(MemberRole.ADMIN, MemberRole.OWNER)
  @Post()
  async inviteUser(
    @Param("projectId") projectId: string,
    @CurrentUser("id") invitedById: string,
    @Body() dto: InviteDto,
  ) {
    return this.inviteService.inviteUser(projectId, invitedById, dto);
  }

  @ProjectRoles(MemberRole.ADMIN, MemberRole.OWNER)
  @Get()
  async findProjectInvites(@Param("projectId") projectId: string) {
    return this.inviteService.findProjectInvites(projectId);
  }

  @ProjectRoles(MemberRole.ADMIN, MemberRole.OWNER)
  @Delete()
  async cancelInvite(
    @Param("projectId") projectId: string,
    @Body() dto: CancelInviteDto,
  ) {
    return this.inviteService.cancelInvite(projectId, dto);
  }
}
