import { IsOptional } from 'class-validator';

export class RequestReviewDto {
	title: string;
	description?: string;
	tags?: string;
	audience: string;
	channelId: string;

	@IsOptional()
	video?: any;

	@IsOptional()
	thumbnail?: any;
}
