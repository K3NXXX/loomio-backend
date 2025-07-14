import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { genSalt, hash } from 'bcrypt';
import { CloudinaryService } from 'src/common/libs/cloudinary/cloudinary.service';
import { PrismaService } from 'src/common/prisma.service';
import { UserDto } from './dto/user.dto';

@Injectable()
export class UserService {
	private readonly logger = new Logger(UserService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly cloudinary: CloudinaryService,
	) {}

	async findById(id: string) {
		return this.prisma.user.findUnique({ where: { id } });
	}

	async findByEmail(email: string) {
		return this.prisma.user.findUnique({ where: { email } });
	}

	async create(dto: UserDto) {
		const existingUser = await this.prisma.user.findUnique({
			where: { email: dto.email },
		});

		if (existingUser) throw new ConflictException(`User with email ${dto.email} already exists`);

		let pwd: string | null = null;

		if (dto.password) {
			const salt = await genSalt(10);
			pwd = await hash(dto.password, salt);
		}

		return this.prisma.user.create({
			data: {
				firstName: dto.firstName?.trim(),
				lastName: dto.lastName?.trim(),
				email: dto.email.trim().toLowerCase(),
				password: pwd,
				avatarUrl: dto.avatarUrl || null,
			},
		});
	}

	async uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ photo: string }> {
		if (!file) throw new BadRequestException('File is required');

		const user = await this.findById(userId);
		if (!user) throw new NotFoundException('User not found');

		if (user.avatarPublicId) {
			try {
				await this.cloudinary.deleteFile(user.avatarPublicId);
			} catch (error) {
				this.logger.warn('Could not delete old avatar', error);
			}
		}

		let uploadResult: any;
		try {
			uploadResult = await this.cloudinary.uploadFile(file, {
				invalidate: true,
			});

			const logger = new Logger(UserService.name);

			logger.log('Upload resuld: ', uploadResult);
		} catch (error) {
			throw new BadRequestException('Failed to upload avatar');
		}

		await this.prisma.user.update({
			where: { id: userId },
			data: {
				avatarUrl: uploadResult.secure_url,
				avatarPublicId: uploadResult.public_id,
			},
		});

		return { photo: uploadResult.secure_url };
	}

	async deleteAvatar(userId: string): Promise<boolean> {
		const user = await this.prisma.user.findUnique({ where: { id: userId } });
		if (!user) throw new NotFoundException('User not found');

		if (user.avatarPublicId) {
			try {
				await this.cloudinary.deleteFile(user.avatarPublicId);
			} catch (error) {
				throw new Error('Error to delete image', error);
			}
		}

		await this.prisma.user.update({
			where: { id: userId },
			data: {
				avatarUrl: null,
				avatarPublicId: null,
			},
		});

		return true;
	}
}
