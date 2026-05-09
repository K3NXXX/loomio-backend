/** 32-char hex UID in Cloudflare Stream / videodelivery.net URLs. */
export function extractCloudflareStreamUidFromVideoUrl(videoFile: string): string | null {
	if (!videoFile) return null;
	const m = videoFile.match(/videodelivery\.net\/([a-f0-9]{32})\//i);
	return m?.[1] ?? null;
}
