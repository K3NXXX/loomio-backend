import { Injectable, NotFoundException } from "@nestjs/common";
import { MemberRole } from "@prisma/client";
import { omit } from "lodash";

import { PrismaService } from "@/common/prisma/prisma.service";

import { CreateProjectDto } from "./dto/create.dto";
import { UpdateProjectDto } from "./dto/update.dto";

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateProjectDto) {
    return this.prisma.$transaction(async (tx) => {
      const { members, ...projectData } = dto;

      const project = await tx.project.create({
        data: {
          ...projectData,
          ownerId,
        },
      });

      await tx.projectSettings.create({
        data: {
          projectId: project.id,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: ownerId,
          role: MemberRole.OWNER,
        },
      });

      if (members?.length) {
        const filteredMembers = members.filter(
          (member) => member.userId !== ownerId,
        );

        if (filteredMembers.length) {
          await tx.projectMember.createMany({
            data: filteredMembers.map((member) => ({
              projectId: project.id,
              userId: member.userId,
              role: member.role,
            })),
            skipDuplicates: true,
          });
        }
      }

      return project;
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
    });
  }

  async findById(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        settings: true,
        members: true,
        tags: true,
      },
    });

    if (
      !project ||
      (project.isPrivate &&
        project.ownerId !== userId &&
        !project.members.some((m) => m.userId === userId))
    )
      throw new NotFoundException("Project not found");

    return project;
  }

  async update(id: string, userId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project || project.ownerId !== userId)
      throw new NotFoundException("Project not found or access denied");

    const data = omit(dto, "members");

    return this.prisma.project.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project || project.ownerId !== userId)
      throw new NotFoundException("Project not found or access denied");

    return this.prisma.project.delete({ where: { id } });
  }
}
