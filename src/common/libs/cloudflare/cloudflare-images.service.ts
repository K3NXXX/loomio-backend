import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class CloudflareImagesService {
	constructor(
		@Inject('CLOUDFLARE')
		private config: { accountId: string; apiToken: string; accountHash: string },
	) {}

	async uploadImage(file: Express.Multer.File) {
		try {
			const formData = new FormData();
			formData.append('file', file.buffer, file.originalname);

			const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/images/v1`;

			const response = await axios.post(url, formData, {
				headers: {
					Authorization: `Bearer ${this.config.apiToken}`,
					...formData.getHeaders(),
				},
			});

			const imageId = response.data.result.id;

			return {
				id: imageId,
				url: `https://imagedelivery.net/${this.config.accountHash}/${imageId}/public`,
			};
		} catch (err) {
			throw new InternalServerErrorException(
				`Cloudflare image upload failed: ${(err as Error).message}`,
			);
		}
	}

	async deleteImage(imageId: string) {
		try {
			const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/images/v1/${imageId}`;

			await axios.delete(url, {
				headers: {
					Authorization: `Bearer ${this.config.apiToken}`,
				},
			});

			return { success: true };
		} catch (err) {
			throw new InternalServerErrorException(
				`Cloudflare image deletion failed: ${(err as Error).message}`,
			);
		}
	}
}
