import { IsString } from 'class-validator';

export class CancelInviteDto {
	@IsString()
	inviteId: string;
}
