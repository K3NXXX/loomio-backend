import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ProjectService } from '../project.service';
import AddMemberDto from './dto/add-member.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class MembersService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly project: ProjectService,
	) {}

	async addMember(projectId: string, requesterId: string, dto: AddMemberDto) {
		if (dto.role === MemberRole.OWNER) throw new BadRequestException('Cannot assign OWNER role');

		const project = await this.project.findById(projectId, requesterId);
		if (!project) throw new NotFoundException('Project not found');

		const existing = await this.findMember(projectId, dto.userId);
		if (existing) throw new ForbiddenException('User is already a member');

		return this.prisma.projectMember.create({
			data: {
				projectId,
				userId: dto.userId,
				role: dto.role,
			},
		});
	}

	async findMember(projectId: string, userId: string) {
		return this.prisma.projectMember.findUnique({
			where: {
				userId_projectId: {
					projectId,
					userId,
				},
			},
		});
	}

	async findMembers(projectId: string) {
		return this.prisma.projectMember.findMany({
			where: { projectId },
			include: {
				user: {
					select: {
						id: true,
						fullName: true,
						username: true,
						avatarUrl: true,
					},
				},
			},
		});
	}

	async updateRole(projectId: string, memberId: string, requesterId: string, dto: UpdateRoleDto) {
		const requester = await this.findMember(projectId, requesterId);
		const member = await this.findMember(projectId, memberId);

		if (!member) throw new NotFoundException('Member not found');
		if (memberId === requesterId) throw new ForbiddenException('You cannot change your own role');

		if (requester?.role === MemberRole.ADMIN && member.role === MemberRole.OWNER)
			throw new ForbiddenException('Admins cannot change owner role');

		return this.prisma.projectMember.update({
			where: {
				userId_projectId: {
					userId: memberId,
					projectId,
				},
			},
			data: {
				role: dto.role,
			},
		});
	}

	async removeMember(projectId: string, requesterId: string, memberId: string) {
		const requester = await this.findMember(projectId, requesterId);
		const member = await this.findMember(projectId, memberId);

		if (!requester || !member) throw new NotFoundException('Member not found');
		if (memberId === requesterId) throw new ForbiddenException('You cannot remove yourself');

		if (requester.role === MemberRole.ADMIN && member.role !== MemberRole.MEMBER)
			throw new ForbiddenException('Admins can only remove members');

		return this.prisma.projectMember.delete({
			where: {
				userId_projectId: {
					userId: memberId,
					projectId,
				},
			},
		});
	}
}
