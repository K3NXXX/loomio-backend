import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InviteStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { MembersService } from '../members/members.service';
import { ProjectService } from '../project.service';
import { AcceptInviteDto } from './dto/accept-ivite.dto';
import { CancelInviteDto } from './dto/cancel-ivite.dto';
import { InviteDto } from './dto/invite.dto';

@Injectable()
export class InviteService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly project: ProjectService,
		private readonly memberService: MembersService,
	) {}

	async inviteUser(projectId: string, invitedById: string, dto: InviteDto) {
		await this.project.findById(projectId, invitedById);

		const existingInvite = await this.prisma.projectInvite.findFirst({
			where: {
				projectId,
				userId: dto.userId,
				status: InviteStatus.PENDING,
			},
		});

		if (existingInvite) throw new ConflictException('User already has a pending invite');

		const existingMember = await this.memberService.findMember(projectId, dto.userId);
		if (existingMember) throw new ConflictException('User is already a project member');

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
						fullName: true,
						username: true,
						email: true,
						avatarUrl: true,
						isActive: true,
					},
				},
			},
		});
	}

	async acceptInvite(userId: string, dto: AcceptInviteDto) {
		const invite = await this.prisma.projectInvite.findUnique({
			where: { token: dto.token },
		});

		if (!invite || invite.status !== 'PENDING' || invite.expiresAt < new Date())
			throw new NotFoundException('Invite is invalid or expired');

		if (invite.userId && invite.userId !== userId)
			throw new ForbiddenException('This invite is not for you');

		await this.prisma.projectMember.create({
			data: {
				projectId: invite.projectId,
				userId,
				role: invite.role,
			},
		});

		await this.prisma.projectInvite.update({
			where: { token: dto.token },
			data: {
				acceptedAt: new Date(),
				status: 'ACCEPTED',
			},
		});

		return { message: 'Invite accepted successfully' };
	}

	async findProjectInvites(projectId: string) {
		return this.prisma.projectInvite.findMany({
			where: {
				projectId,
				status: 'PENDING',
			},
			include: {
				user: {
					select: {
						id: true,
						fullName: true,
						email: true,
					},
				},
			},
		});
	}

	async findUserInvites(userId: string, email?: string) {
		return this.prisma.projectInvite.findMany({
			where: {
				status: 'PENDING',
				OR: [{ userId }, { email }],
				expiresAt: { gt: new Date() },
			},
			include: {
				project: {
					select: {
						id: true,
						name: true,
						color: true,
					},
				},
				invitedBy: {
					select: {
						id: true,
						fullName: true,
						email: true,
					},
				},
			},
			orderBy: { createdAt: 'desc' },
		});
	}

	async cancelInvite(projectId: string, dto: CancelInviteDto) {
		const invite = await this.prisma.projectInvite.findUnique({
			where: { id: dto.inviteId },
		});

		if (!invite || invite.projectId !== projectId) throw new NotFoundException('Invite not found');

		return this.prisma.projectInvite.delete({
			where: { id: dto.inviteId },
		});
	}
}
