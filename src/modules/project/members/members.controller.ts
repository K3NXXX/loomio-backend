import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { MemberRole } from "@prisma/client";

import { Authorization } from "@/common/decorators/auth.decorators";
import { ProjectRoles } from "@/common/decorators/project-role.decorator";
import { CurrentUser } from "@/common/decorators/user.decorator";

import AddMemberDto from "./dto/add-member.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { MembersService } from "./members.service";

@Authorization()
@Controller("projects/:projectId/members")
export class MembersController {
  constructor(private readonly service: MembersService) {}

  @ProjectRoles(MemberRole.ADMIN, MemberRole.OWNER)
  @Post()
  async addMember(
    @Param("projectId") projectId: string,
    @CurrentUser("id") requesterId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.service.addMember(projectId, requesterId, dto);
  }

  @Get()
  findAll(@Param("projectId") projectId: string) {
    return this.service.findMembers(projectId);
  }

  @ProjectRoles(MemberRole.ADMIN, MemberRole.OWNER)
  @Patch(":memberId/role")
  updateRole(
    @Param("projectId") projectId: string,
    @Param("memberId") memberId: string,
    @CurrentUser("id") userId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.service.updateRole(projectId, memberId, userId, dto);
  }

  @ProjectRoles(MemberRole.ADMIN, MemberRole.OWNER)
  @Delete(":memberId")
  remove(
    @Param("projectId") projectId: string,
    @CurrentUser("id") requesterId: string,
    @Param("memberId") memberId: string,
  ) {
    return this.service.removeMember(projectId, requesterId, memberId);
  }
}
