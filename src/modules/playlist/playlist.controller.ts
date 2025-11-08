import { Authorization } from '@/common/decorators/auth.decorators';
import { CurrentUser } from '@/common/decorators/user.decorator';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { PlaylistService } from './playlist.service';

@Controller('playlist')
export class PlaylistController {
	constructor(private readonly playlistService: PlaylistService) {}

	@Authorization()
	@Post()
	create(@CurrentUser('id') userId: string, @Body() dto: CreatePlaylistDto) {
		return this.playlistService.create(userId, dto);
	}

	@Authorization()
	@Get('me')
	getMyPlaylists(@CurrentUser('id') userId: string) {
		return this.playlistService.getUserPlaylists(userId);
	}

	@Authorization()
	@Get(':id')
	getById(@CurrentUser('id') userId: string, @Param('id') id: string) {
		return this.playlistService.getById(userId, id);
	}

	@Authorization()
	@Patch(':id')
	update(
		@CurrentUser('id') userId: string,
		@Param('id') id: string,
		@Body() dto: UpdatePlaylistDto,
	) {
		return this.playlistService.update(userId, id, dto);
	}

	@Authorization()
	@Delete(':id')
	delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
		return this.playlistService.delete(userId, id);
	}
}
