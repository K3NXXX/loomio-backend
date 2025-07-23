import { MemberRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateRoleDto {
	@IsEnum(MemberRole)
	role: MemberRole;
}
