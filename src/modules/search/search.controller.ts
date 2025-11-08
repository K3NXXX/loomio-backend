import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
	constructor(private readonly searchService: SearchService) {}

	@Get('suggest')
	async suggest(@Query('q') query: string) {
		return this.searchService.getSuggestions(query);
	}

	@Get()
	async search(@Query('q') query: string) {
		return this.searchService.search(query);
	}
}
