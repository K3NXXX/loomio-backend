import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class CloudflareStreamService {
	constructor(
		@Inject('CLOUDFLARE')
		private config: { accountId: string; apiToken: string },
	) {}

	async createDirectUpload() {
		const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/stream/direct_upload`;

		const response = await axios.post(
			url,
			{ maxDurationSeconds: 3600 },
			{
				headers: {
					Authorization: `Bearer ${this.config.apiToken}`,
				},
			},
		);

		return {
			uploadURL: response.data.result.uploadURL,
			videoId: response.data.result.uid,
		};
	}

	async deleteVideo(videoId: string) {
		const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/stream/${videoId}`;

		await axios.delete(url, {
			headers: {
				Authorization: `Bearer ${this.config.apiToken}`,
			},
		});

		return { success: true };
	}

	async getVideoStatus(videoId: string) {
		const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/stream/${videoId}`;

		const response = await axios.get(url, {
			headers: {
				Authorization: `Bearer ${this.config.apiToken}`,
			},
		});

		return response.data.result.status.state;
	}
}
