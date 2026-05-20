import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export type PublicVideoFeed = 'home' | 'kids';

export class PublicVideosQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(60)
	limit?: number;

	/** `home` — general audience only; `kids` — kids-only tab */
	@IsOptional()
	@IsIn(['home', 'kids'])
	feed?: PublicVideoFeed;
}
