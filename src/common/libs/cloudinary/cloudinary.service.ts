import { Inject, Injectable } from '@nestjs/common';
import {
	v2 as CloudinaryType,
	UploadApiErrorResponse,
	UploadApiOptions,
	UploadApiResponse,
} from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
	constructor(@Inject('CLOUDINARY') private cloudinary: typeof CloudinaryType) {}

	async uploadFile(
		file: Express.Multer.File,
		options?: UploadApiOptions,
	): Promise<UploadApiResponse> {
		return new Promise((resolve, reject) => {
			const uploadStream = this.cloudinary.uploader.upload_stream(
				{ upload_preset: 'nextgen', options },
				(error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
					if (error || !result) return reject(error || new Error('Unknown upload error'));
					resolve(result);
				},
			);
			streamifier.createReadStream(file.buffer).pipe(uploadStream);
		});
	}

	async deleteFile(publicId: string): Promise<{ result: string }> {
		const result = await this.cloudinary.uploader.destroy(publicId);
		if (result.result !== 'ok') {
			throw new Error(`Failed to delete image: ${JSON.stringify(result)}`);
		}
		return result;
	}
}
