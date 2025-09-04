import { MemberRole } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class InviteDto {
	@IsUUID()
	userId: string;

	@IsEnum(MemberRole)
	@IsOptional()
	role?: MemberRole;
}
