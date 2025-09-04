import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class SearchUsersDto {
	@IsString()
	@MinLength(1)
	query: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	take?: number;

	@IsOptional()
	@IsUUID()
	cursor?: string;
}
