import { Inject, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

type CfStreamDownloadVariant = {
	status?: string;
	url?: string;
	percentComplete?: number;
};

const MP4_DOWNLOAD_POLL_ATTEMPTS = 46;
const MP4_DOWNLOAD_POLL_INTERVAL_MS = 2000;

const MP4_TERMINAL_READY = new Set(['ready', 'finished', 'completed', 'available', 'success']);

@Injectable()
export class CloudflareStreamService {
	private readonly logger = new Logger(CloudflareStreamService.name);

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
			}
		}
		return null;
	}

	async resolveMp4DownloadUrl(streamUid: string): Promise<string> {
		const seeded = await this.ensureDefaultMp4Queued(streamUid);
		if (seeded?.url?.trim() && this.isDownloadProbablyUsable(seeded)) {
			return seeded.url.trim();
		}

		let lastPeek: CfStreamDownloadVariant | null = seeded ?? null;

		for (let i = 0; i < MP4_DOWNLOAD_POLL_ATTEMPTS; i++) {
			if (i > 0) {
				await new Promise((r) => setTimeout(r, MP4_DOWNLOAD_POLL_INTERVAL_MS));
			}
			const variant = await this.fetchDefaultMp4Variant(streamUid);
			if (!variant) {
				continue;
			}
			lastPeek = variant;

			const st = String(variant.status ?? '').toLowerCase();
			const url = variant.url?.trim();
			const pct =
				typeof variant.percentComplete === 'number' && Number.isFinite(variant.percentComplete)
					? variant.percentComplete
					: null;

			if (st === 'error') {
				throw new Error(
					'Cloudflare Stream marked the default MP4 download as error. Check Stream dashboard.',
				);
			}
			if (!url) {
				continue;
			}

			if (MP4_TERMINAL_READY.has(st) || (pct !== null && pct >= 100 && st !== 'error')) {
				return url;
			}

			if (pct !== null && pct >= 98) {
				return url;
			}

			const lateEnough =
				i >= Math.max(20, Math.floor(MP4_DOWNLOAD_POLL_ATTEMPTS * 0.38)) ||
				(pct !== null && pct >= 92);
			if (lateEnough && st !== 'error') {
				this.logger.warn(
					`resolveMp4DownloadUrl: using CDN URL despite status="${variant.status}" pct=${pct} iter=${i} uid=${streamUid}`,
				);
				return url;
			}
		}

		const fallbackUrl = lastPeek?.url?.trim();
		if (fallbackUrl && String(lastPeek?.status ?? '').toLowerCase() !== 'error') {
			this.logger.warn(
				`resolveMp4DownloadUrl: last-chance CDN URL uid=${streamUid} status=${lastPeek?.status} pct=${lastPeek?.percentComplete}`,
			);
			return fallbackUrl;
		}

		const approxSec = Math.round(
			((MP4_DOWNLOAD_POLL_ATTEMPTS - 1) * MP4_DOWNLOAD_POLL_INTERVAL_MS) / 1000,
		);

		throw new Error(
			`Timed out after ~${approxSec}s waiting for Stream MP4 (last status="${lastPeek?.status ?? 'none'}"). Retry download or shorten the source video.`,
		);
	}

	private isDownloadProbablyUsable(v: CfStreamDownloadVariant): boolean {
		const st = String(v.status ?? '').toLowerCase();
		const url = v.url?.trim();
		if (!url || st === 'error') return false;
		if (MP4_TERMINAL_READY.has(st)) return true;
		const pctRaw = v.percentComplete;
		if (typeof pctRaw === 'number' && Number.isFinite(pctRaw) && pctRaw >= 98) {
			return true;
		}
		return false;
	}

	private accountStreamBase(streamUid: string): string {
		return `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/stream/${streamUid}`;
	}

	private async ensureDefaultMp4Queued(streamUid: string): Promise<CfStreamDownloadVariant | null> {
		const url = `${this.accountStreamBase(streamUid)}/downloads`;
		try {
			const response = await axios.post(
				url,
				{},
				{
					headers: {
						Authorization: `Bearer ${this.config.apiToken}`,
						'Content-Type': 'application/json',
					},
				},
			);
			return this.pickDefaultDownloadVariant(response.data) ?? null;
		} catch (e: unknown) {
			if (!axios.isAxiosError(e) || !e.response) {
				this.logger.warn(
					`ensureDefaultMp4Queued: POST failed uri=${streamUid}: ${e instanceof Error ? e.message : String(e)}`,
				);
				return null;
			}
			const sc = e.response.status;
			if (sc === 400 || sc === 409) {
				return null;
			}
			const body =
				typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data);
			throw new Error(
				`Stream POST /downloads failed (${sc}): ${body?.slice?.(0, 500) ?? body}. Confirm CF_API_TOKEN includes Stream Edit.`,
			);
		}
	}

	private async fetchDefaultMp4Variant(streamUid: string): Promise<CfStreamDownloadVariant | null> {
		const url = `${this.accountStreamBase(streamUid)}/downloads`;
		let response;
		try {
			response = await axios.get(url, {
				headers: { Authorization: `Bearer ${this.config.apiToken}` },
			});
		} catch (e: unknown) {
			if (!axios.isAxiosError(e) || !e.response) {
				this.logger.warn(
					`fetchDefaultMp4Variant: GET failed uid=${streamUid}: ${e instanceof Error ? e.message : String(e)}`,
				);
				return null;
			}
			const sc = e.response.status;
			if (sc === 404 || sc === 400) return null;
			const body =
				typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data);
			throw new Error(`Stream GET /downloads failed (${sc}): ${body?.slice?.(0, 400) ?? ''}`);
		}

		const body = response.data as ApiDownloadsEnvelope;
		if (body.success === false) {
			const hint = JSON.stringify(body.errors ?? body.messages ?? 'unknown');
			this.logger.warn(
				`fetchDefaultMp4Variant: success=false uid=${streamUid} ${hint.slice(0, 400)}`,
			);
		}

		return this.pickDefaultDownloadVariant(body) ?? null;
	}

	private pickDefaultDownloadVariant(data: unknown): CfStreamDownloadVariant | null {
		if (!data || typeof data !== 'object') return null;
		const root = data as ApiDownloadsEnvelope;
		const result = root.result as Record<string, unknown> | undefined;
		if (!result || typeof result !== 'object') return null;

		const dflt = result.default;
		if (dflt && typeof dflt === 'object') return dflt as CfStreamDownloadVariant;

		const legacy = result.downloads;
		if (Array.isArray(legacy)) {
			const row =
				legacy.find(
					(x: unknown) =>
						x &&
						typeof x === 'object' &&
						(('label' in (x as object) && (x as { label?: string }).label === 'default') ||
							('type' in (x as object) && String((x as { type?: string }).type) === 'mp4')),
				) ?? legacy[0];
			if (row && typeof row === 'object') return row as CfStreamDownloadVariant;
		}
		return null;
	}
}

type ApiDownloadsEnvelope = {
	success?: boolean;
	result?: unknown;
	errors?: unknown[];
	messages?: unknown[];
};
