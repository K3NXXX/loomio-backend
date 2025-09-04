import { MemberRole } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export default class AddMemberDto {
	@IsUUID()
	userId: string;

	@IsEnum(MemberRole)
	role: MemberRole;
}
