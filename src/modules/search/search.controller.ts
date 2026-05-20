import { Controller, Get, Query } from '@nestjs/common';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
	constructor(private readonly searchService: SearchService) {}

	@Get('suggest')
	async suggest(@Query('q') query: string) {
		return this.searchService.getSuggestions(query);
	}

	@Get()
	async search(@Query() dto: SearchQueryDto) {
		return this.searchService.search(dto.q ?? '', dto.page ?? 1, dto.limit ?? 20);
	}
}
