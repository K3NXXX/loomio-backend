import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InviteStatus } from "@prisma/client";

import { PrismaService } from "@/common/prisma/prisma.service";

import { MembersService } from "../members/members.service";
import { ProjectService } from "../project.service";

import { CancelInviteDto } from "./dto/cancel-ivite.dto";
import { InviteDto } from "./dto/invite.dto";

@Injectable()
export class InviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly project: ProjectService,
    private readonly memberService: MembersService,
  ) {}

  async findProjectInvites(projectId: string) {
    return this.prisma.projectInvite.findMany({
      where: {
        projectId,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async findUserInvites(userId: string, email?: string) {
    return this.prisma.projectInvite.findMany({
      where: {
        status: "PENDING",
        OR: [{ userId }, { email }],
        expiresAt: { gt: new Date() },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async inviteUser(projectId: string, invitedById: string, dto: InviteDto) {
    await this.project.findById(projectId, invitedById);

    const existingInvite = await this.prisma.projectInvite.findFirst({
      where: {
        projectId,
        userId: dto.userId,
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite)
      throw new ConflictException("User already has a pending invite");

    const existingMember = await this.memberService.findMember(
      projectId,
      dto.userId,
    );
    if (existingMember)
      throw new ConflictException("User is already a project member");

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    return this.prisma.projectInvite.create({
      data: {
        userId: dto.userId,
        role: dto.role,
        token,
        expiresAt,
        projectId,
        invitedById,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
    });
  }

  async resendInvite(inviteId: string) {
    const invite = await this.prisma.projectInvite.findUnique({
      where: { id: inviteId },
      include: {
        project: { select: { ownerId: true } },
      },
    });

    if (!invite) throw new NotFoundException("Invite not found");
    if (invite.status !== InviteStatus.PENDING)
      throw new ConflictException("Cannot resend a non-pending invite");

    const newToken = crypto.randomUUID();
    const newExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    return this.prisma.projectInvite.update({
      where: { id: inviteId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatarUrl: true,
            isActive: true,
          },
        },
      },
    });
  }

  async acceptInvite(userId: string, token: string) {
    const invite = await this.prisma.projectInvite.findUnique({
      where: { token: token },
    });

    if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date())
      throw new NotFoundException("Invite is invalid or expired");

    if (invite.userId && invite.userId !== userId)
      throw new ForbiddenException("This invite is not for you");

    await this.prisma.projectMember.create({
      data: {
        projectId: invite.projectId,
        userId,
        role: invite.role,
      },
    });

    await this.prisma.projectInvite.update({
      where: { token: token },
      data: {
        acceptedAt: new Date(),
        status: "ACCEPTED",
      },
    });

    return { message: "Invite accepted successfully" };
  }

  async cancelInvite(projectId: string, dto: CancelInviteDto) {
    const invite = await this.prisma.projectInvite.findUnique({
      where: { id: dto.inviteId },
    });

    if (!invite || invite.projectId !== projectId)
      throw new NotFoundException("Invite not found");

    return this.prisma.projectInvite.delete({
      where: { id: dto.inviteId },
    });
  }

  async declineInvite(userId: string, inviteId: string) {
    const invite = await this.prisma.projectInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) throw new NotFoundException("Invite not found");

    const isRecipient = invite.userId === userId;
    if (!isRecipient)
      throw new ForbiddenException(
        "You are not allowed to decline this invite",
      );

    if (invite.status !== "PENDING")
      throw new BadRequestException("Invite is no longer active");

    return this.prisma.projectInvite.update({
      where: { id: inviteId },
      data: { status: InviteStatus.DECLINED },
    });
  }
}
