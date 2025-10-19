import { Authorization } from '@/common/decorators/auth.decorators';
import { CurrentUser } from '@/common/decorators/user.decorator';
import { RequestWithUser } from '@/common/types/request-with-user.interface';
import { Body, Controller, Get, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChannelService } from './channel.service';
import { CreateChannelDto } from './dto/create-channel.dto';

@Controller('channel')
export class ChannelController {
	constructor(private readonly channelService: ChannelService) {}

	@Authorization()
	@UseInterceptors(FileInterceptor('avatar '))
	@Post()
	create(
		@Req() req: RequestWithUser,
		@Body() dto: CreateChannelDto,
		@UploadedFile() avatar?: Express.Multer.File, 
	) {
		return this.channelService.create(req.user.id, dto, avatar);
	}

	@Authorization()
	@Get('me')
	myChannels(@CurrentUser('id') userId: string) {
		return this.channelService.findUserChannels(userId);
	}

	//   // PUBLIC PROFILE BY USERNAME
	//   @Get('@:username')
	//   getByUsername(@Param('username') username: string) {
	//     return this.channelService.findPublicByUsername(username);
	//   }

	//   // UPDATE
	//   @Authorization()
	//   @Patch(':id')
	//   update(
	//     @Param('id') id: string,
	//     @CurrentUser('id') userId: string,
	//     @Body() dto: UpdateChannelDto,
	//   ) {
	//     return this.channelService.update(userId, id, dto);
	//   }

	//   // SET DEFAULT
	//   @Authorization()
	//   @Patch(':id/default')
	//   setDefault(@Param('id') id: string, @CurrentUser('id') userId: string) {
	//     return this.channelService.setDefault(userId, id);
	//   }

	//   // DELETE
	//   @Authorization()
	//   @Delete(':id')
	//   remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
	//     return this.channelService.delete(userId, id);
	//   }

	//   // FOLLOW / UNFOLLOW CHANNEL
	//   @Authorization()
	//   @Post(':id/follow')
	//   toggleFollow(@Param('id') channelId: string, @CurrentUser('id') userId: string) {
	//     return this.channelService.toggleFollow(userId, channelId);
	//   }

	//   // CHECK IF CURRENT USER FOLLOWS
	//   @Authorization()
	//   @Get(':id/is-following')
	//   isFollowing(@Param('id') channelId: string, @CurrentUser('id') userId: string) {
	//     return this.channelService.isFollowing(userId, channelId);
	//   }

	//   // FOLLOWERS COUNT (public)
	//   @Get(':id/followers/count')
	//   followersCount(@Param('id') channelId: string) {
	//     return this.channelService.followerCount(channelId);
	//   }

	//   // OPTIONAL: channel videos listing with pagination (public)
	//   @Get(':id/videos')
	//   videos(
	//     @Param('id') channelId: string,
	//     @Query('page') page = '1',
	//     @Query('take') take = '12',
	//   ) {
	//     return this.channelService.listVideos(channelId, +page, +take);
	//   }
}
