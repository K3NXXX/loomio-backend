import { Injectable, NotFoundException } from '@nestjs/common';
import { compare, hashSync } from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/common/prisma.service';

@Injectable()
export class UserSessionService {
	constructor(private readonly prisma: PrismaService) {}

	async create(data: { userId: string; createdByIp: string; userAgent?: string; expiresIn: Date }) {
		await this.prisma.userSession.deleteMany({
			where: {
				userId: data.userId,
				OR: [{ revoked: true }, { expiresIn: { lt: new Date() } }],
			},
		});

		const existing = await this.prisma.userSession.findFirst({
			where: {
				userId: data.userId,
				createdByIp: data.createdByIp,
				userAgent: data.userAgent,
				revoked: false,
				expiresIn: { gt: new Date() },
			},
		});

		if (existing) await this.prisma.userSession.delete({ where: { id: existing.id } });

		const id = crypto.randomUUID();
		const secret = randomBytes(32).toString('hex');
		const token = hashSync(secret, 10);

		await this.prisma.userSession.create({
			data: {
				id,
				userId: data.userId,
				token,
				createdByIp: data.createdByIp,
				userAgent: data.userAgent,
				expiresIn: data.expiresIn,
			},
		});

		return `${id}.${secret}`;
	}

	async findByToken(token: string) {
		const [id, secret] = token.split('.');
		if (!id || !secret) return null;

		const session = await this.prisma.userSession.findUnique({
			where: { id },
			include: { user: true },
		});

		if (!session || session.revoked || session.expiresIn < new Date()) return null;

		const isMatch = await compare(secret, session.token);
		if (!isMatch) return null;

		return session;
	}

	async findUserSessions(userId: string) {
		return this.prisma.userSession.findMany({
			where: {
				userId,
				revoked: false,
				expiresIn: { gt: new Date() },
			},
			orderBy: { createdAt: 'desc' },
		});
	}

	async revoke(sessionId: string) {
		return this.prisma.userSession.update({
			where: { id: sessionId },
			data: { revoked: true, revokedAt: new Date() },
		});
	}

	async deleteSession(userId: string, sessionId: string) {
		const session = await this.prisma.userSession.findUnique({ where: { id: sessionId } });

		if (!session || session.userId !== userId) {
			throw new NotFoundException('Session not found or access denied');
		}

		await this.prisma.userSession.delete({ where: { id: sessionId } });
	}
}
