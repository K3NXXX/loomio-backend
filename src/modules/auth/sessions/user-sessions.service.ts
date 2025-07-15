import { Injectable, NotFoundException } from '@nestjs/common';
import { compare, hashSync } from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from 'src/common/prisma.service';
import { UserSessionDto } from './dto/user-session.dto';

@Injectable()
export class UserSessionService {
	constructor(private readonly prisma: PrismaService) {}

	async create(dto: UserSessionDto): Promise<string> {
		const id = randomUUID();
		const secret = randomBytes(32).toString('hex');
		const token = hashSync(secret, 10);

		await this.prisma.$transaction([
			this.prisma.userSession.deleteMany({
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

			this.prisma.userSession.create({
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

		const session = await this.prisma.userSession.findUnique({
			where: { id },
			include: { user: true },
		});

		if (!session || session.revoked || session.expiresAt < new Date()) return null;

		const isMatch = await compare(secret, session.token);
		if (!isMatch) return null;

		return session;
	}

	async findUserSessions(userId: string) {
		return this.prisma.userSession.findMany({
			where: {
				userId,
				revoked: false,
				expiresAt: { gt: new Date() },
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
