import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
	@IsString()
	name: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@IsString()
	color?: string;

	@IsOptional()
	@IsBoolean()
	isPrivate?: boolean;
}
