import { PrismaService } from '@/common/prisma/prisma.service'
import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class FollowService {
	constructor(private readonly prisma: PrismaService) {}

	async toggleFollow(followerId: string, followingId: string) {
		if (followerId === followingId) throw new BadRequestException('Cannot follow yourself');

		const followingUser = await this.prisma.user.findUnique({
			where: { id: followingId },
		});

		if (!followingUser) throw new BadRequestException('User to follow not found');

		const existing = await this.prisma.follows.findUnique({
			where: {
				followerId_followingId: {
					followerId,
					followingId,
				},
			},
		});

		if (existing) {
			await this.prisma.follows.delete({
				where: { id: existing.id },
			});
			return { following: false };
		}

		await this.prisma.follows.create({
			data: {
				followerId,
				followingId,
			},
		});

		return { following: true };
	}

	// async getFollowers(userId: string) {
	// 	return this.prisma.follow
	// 		.findMany({
	// 			where: { followingId: userId },
	// 			select: {
	// 				follower: {
	// 					select: {
	// 						id: true,
	// 						firstName: true,
	// 						lastName: true,
	// 						username: true,
	// 						avatarUrl: true,
	// 					},
	// 				},
	// 				createdAt: true,
	// 			},
	// 		})
	// 		.then((followers) =>
	// 			followers.map((f) => ({
	// 				...f.follower,
	// 				createdAt: f.createdAt,
	// 			})),
	// 		);
	// }

	// async getFollowing(userId: string) {
	// 	return this.prisma.follow
	// 		.findMany({
	// 			where: { followerId: userId },
	// 			select: {
	// 				following: {
	// 					select: {
	// 						id: true,
	// 						firstName: true,
	// 						lastName: true,
	// 						username: true,
	// 						avatarUrl: true,
	// 					},
	// 				},
	// 				createdAt: true,
	// 			},
	// 		})
	// 		.then((following) =>
	// 			following.map((f) => ({
	// 				...f.following,
	// 				createdAt: f.createdAt,
	// 			})),
	// 		);
	// }

	// async getUserFollowers(targetUserId: string, currentUserId: string) {
	// 	const followers = await this.prisma.follow.findMany({
	// 		where: { followingId: targetUserId },
	// 		select: {
	// 			follower: {
	// 				select: {
	// 					id: true,
	// 					firstName: true,
	// 					lastName: true,
	// 					username: true,
	// 					avatarUrl: true,
	// 				},
	// 			},
	// 			createdAt: true,
	// 		},
	// 	});

	// 	const currentUserFollowing = await this.prisma.follow.findMany({
	// 		where: {
	// 			followerId: currentUserId,
	// 			followingId: { in: followers.map((f) => f.follower.id) },
	// 		},
	// 		select: { followingId: true },
	// 	});

	// 	const followingSet = new Set(currentUserFollowing.map((f) => f.followingId));

	// 	return followers.map((f) => ({
	// 		...f.follower,
	// 		isFollowed: followingSet.has(f.follower.id),
	// 		createdAt: f.createdAt,
	// 	}));
	// }

	// async getUserFollowing(targetUserId: string, currentUserId: string) {
	// 	const following = await this.prisma.follow.findMany({
	// 		where: { followerId: targetUserId },
	// 		select: {
	// 			following: {
	// 				select: {
	// 					id: true,
	// 					firstName: true,
	// 					lastName: true,
	// 					username: true,
	// 					avatarUrl: true,
	// 				},
	// 			},
	// 			createdAt: true,
	// 		},
	// 	});

	// 	const currentUserFollowing = await this.prisma.follow.findMany({
	// 		where: {
	// 			followerId: currentUserId,
	// 			followingId: { in: following.map((f) => f.following.id) },
	// 		},
	// 		select: { followingId: true },
	// 	});

	// 	const followingSet = new Set(currentUserFollowing.map((f) => f.followingId));

	// 	return following.map((f) => ({
	// 		...f.following,
	// 		isFollowed: followingSet.has(f.following.id),
	// 		createdAt: f.createdAt,
	// 	}));
	// }

	// async getFollowingIds(userId: string): Promise<string[]> {
	// 	const follows = await this.prisma.follow.findMany({
	// 		where: { followerId: userId },
	// 		select: { followingId: true },
	// 	});
	// 	return follows.map((f) => f.followingId);
	// }

	async isFollowing(userId: string, followingId: string) {
		const existing = await this.prisma.follows.findUnique({
			where: {
				followerId_followingId: {
					followerId: userId,
					followingId: followingId,
				},
			},
		});
		return { isFollowing: !!existing };
	}
}
