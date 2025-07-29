import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SearchUsersDto {
	@IsString()
	@MinLength(1)
	query: string;

	@IsOptional()
	take?: number;

	@IsOptional()
	@IsUUID()
	cursor?: string;
}
