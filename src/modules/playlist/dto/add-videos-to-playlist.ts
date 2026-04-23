import { IsArray, IsString } from "class-validator";

export class AddVideosToPlaylistDto {
    @IsArray()
    @IsString({ each: true })
    videoIds: string[]
}