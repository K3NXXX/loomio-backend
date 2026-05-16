import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';

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

	async copyFromUrl(sourceUrl: string, meta?: { name?: string; tags?: string[] }) {
		const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/stream/copy`;

		const response = await axios.post(
			url,
			{ url: sourceUrl, meta: meta ?? {} },
			{
				headers: {
					Authorization: `Bearer ${this.config.apiToken}`,
					'Content-Type': 'application/json',
				},
			},
		);

		if (!response.data?.success) {
			const msg = response.data?.errors?.map((e: { message: string }) => e.message).join('; ');
			throw new Error(`Stream copy failed: ${msg ?? JSON.stringify(response.data)}`);
		}

		return response.data.result.uid as string;
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

	/** Duration in seconds when Cloudflare has finished processing; may be missing while pending. */
	async getVideoDurationSeconds(videoId: string): Promise<number | null> {
		const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/stream/${videoId}`;

		const response = await axios.get(url, {
			headers: {
				Authorization: `Bearer ${this.config.apiToken}`,
			},
		});

		const body = response.data as {
			success?: boolean;
			result?: { duration?: unknown; status?: { state?: string } };
		};
		if (body?.success === false || !body?.result) {
			return null;
		}

		const raw = body.result.duration;
		const num = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
		if (typeof num !== 'number' || !Number.isFinite(num) || num <= 0) {
			return null;
		}
		return Math.round(num);
	}

	/**
	 * Stream often reports duration only after encoding; retry a few times (create + backfill).
	 */
	async getVideoDurationSecondsWithRetry(
		videoId: string,
		opts: { attempts: number; delayMs: number } = { attempts: 5, delayMs: 2000 },
	): Promise<number | null> {
		for (let i = 0; i < opts.attempts; i++) {
			if (i > 0) {
				await new Promise((r) => setTimeout(r, opts.delayMs));
			}
			try {
				const d = await this.getVideoDurationSeconds(videoId);
				if (d != null) return d;
			} catch {
				/* network / 4xx — try again */
			}
		}
		return null;
	}
}
