import { IsOptional, IsString, MinLength } from 'class-validator';

export class SearchUsersDto {
	@IsString()
	@MinLength(1)
	query: string;

	@IsOptional()
	@IsString()
	cursor?: string;

	@IsOptional()
	take?: number;
}
