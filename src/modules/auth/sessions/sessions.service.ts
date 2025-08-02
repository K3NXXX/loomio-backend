import { Injectable, NotFoundException } from '@nestjs/common';
import { hash, verify } from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { SessionDto } from './dto/session.dto';

@Injectable()
export class SessionService {
	constructor(private readonly prisma: PrismaService) {}

	async create(dto: SessionDto): Promise<string> {
		const id = randomUUID();
		const secret = randomBytes(64).toString('hex');
		const token = await hash(secret);

		await this.prisma.$transaction([
			this.prisma.session.deleteMany({
				where: {
					OR: [
						{
							userId: dto.userId,
							OR: [{ revoked: true }, { expiresAt: { lt: new Date() } }],
						},
						{
							ip: dto.ip,
							userAgent: dto.userAgent,
							revoked: false,
							expiresAt: { gt: new Date() },
						},
					],
				},
			}),

			this.prisma.session.create({
				data: {
					id,
					userId: dto.userId,
					token,
					ip: dto.ip,
					userAgent: dto.userAgent,
					expiresAt: dto.expiresAt,
				},
			}),
		]);

		return `${id}.${secret}`;
	}

	async findByToken(token: string) {
		const [id, secret] = token.split('.');
		if (!id || !secret) return null;

		const session = await this.prisma.session.findUnique({
			where: { id },
			include: {
				user: true,
			},
		});

		if (!session || session.revoked || session.expiresAt < new Date()) return null;

		const isMatch = await verify(session.token, secret);
		if (!isMatch) return null;

		return session;
	}

	async findUserSessions(userId: string) {
		return this.prisma.session.findMany({
			where: {
				userId,
				revoked: false,
				expiresAt: { gt: new Date() },
			},
			orderBy: { createdAt: 'desc' },
		});
	}

	async revoke(sessionId: string) {
		return this.prisma.session.update({
			where: { id: sessionId, revokedAt: null },
			data: { revoked: true, revokedAt: new Date() },
		});
	}

	async revokeAll(userId: string) {
		await this.prisma.session.updateMany({
			where: { userId, revoked: false, expiresAt: { gt: new Date() } },
			data: { revoked: true, revokedAt: new Date() },
		});
	}

	async delete(userId: string, sessionId: string) {
		const session = await this.prisma.session.findUnique({ where: { id: sessionId } });

		if (!session || session.userId !== userId) {
			throw new NotFoundException('Session not found or access denied');
		}

		await this.prisma.session.delete({ where: { id: sessionId } });
	}
}
