import axios from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Audience, PrismaClient, PublishType, Visibility } from '@prisma/client';

function loadDotenvFromBackendRoot() {
	const envPath = path.resolve(__dirname, '..', '.env');
	if (!fs.existsSync(envPath)) return;
	for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		const i = t.indexOf('=');
		if (i === -1) continue;
		const k = t.slice(0, i).trim();
		let v = t.slice(i + 1).trim();
		if (
			(v.startsWith('"') && v.endsWith('"')) ||
			(v.startsWith("'") && v.endsWith("'"))
		) {
			v = v.slice(1, -1);
		}
		if (process.env[k] === undefined) process.env[k] = v;
	}
}

const prisma = new PrismaClient();

const TAG_SETS = [
	['gaming', 'walkthrough'],
	['music', 'cover'],
	['news', 'world'],
	['tech', 'review'],
	['cooking', 'recipe'],
	['sport', 'highlights'],
];

const DEFAULT_SAMPLE_MP4 =
	'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4';

function resolveSourceMp4Urls(): string[] {
	const multi = process.env.SEED_SOURCE_VIDEO_URLS?.trim();
	if (multi) {
		return multi
			.split(/[,\n]+/)
			.map((s) => s.trim())
			.filter(Boolean);
	}
	const one = (process.env.SEED_SOURCE_VIDEO_URL || DEFAULT_SAMPLE_MP4).trim();
	return one ? [one] : [];
}

function resolveThumbnailImageUrls(): string[] {
	const multi = process.env.SEED_THUMBNAIL_URLS?.trim();
	if (multi) {
		return multi
			.split(/[,\n]+/)
			.map((s) => s.trim())
			.filter(Boolean);
	}
	const one = process.env.SEED_THUMBNAIL_URL?.trim();
	return one ? [one] : [];
}

async function streamCopyFromUrl(
	accountId: string,
	token: string,
	sourceUrl: string,
	name: string,
): Promise<string> {
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`;
	const response = await axios.post(
		url,
		{ url: sourceUrl, meta: { name } },
		{
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
		},
	);
	if (!response.data?.success) {
		const rawErrs = response.data?.errors as
			| Array<{ message?: string; code?: string }>
			| undefined;
		const msg = rawErrs?.map((e) => e.message || e.code).join('; ');
		throw new Error(`Stream copy failed: ${msg ?? JSON.stringify(response.data)}`);
	}
	return response.data.result.uid as string;
}

async function waitForStreamReady(
	accountId: string,
	token: string,
	uid: string,
	deadlineMs: number,
): Promise<void> {
	const end = Date.now() + deadlineMs;
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`;

	while (Date.now() < end) {
		const response = await axios.get(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const state = response.data?.result?.status?.state as string | undefined;

		if (state === 'ready') return;
		if (state === 'error') {
			throw new Error(
				`Stream encoding failed for ${uid}: ${JSON.stringify(response.data?.result?.status)}`,
			);
		}
		await new Promise((r) => setTimeout(r, 2500));
	}
	throw new Error(`Timeout waiting for Stream ready: ${uid}`);
}

async function main() {
	loadDotenvFromBackendRoot();

	const accountId = process.env.CF_ACCOUNT_ID?.trim();
	const apiToken = process.env.CF_API_TOKEN?.trim();
	const skipCf = process.env.SEED_SKIP_CLOUDFLARE === '1';
	const perRow = process.env.SEED_STREAM_PER_ROW === '1';

	const sourceUrls = resolveSourceMp4Urls();
	if (sourceUrls.length === 0) {
		throw new Error('Set SEED_SOURCE_VIDEO_URL or SEED_SOURCE_VIDEO_URLS with at least one MP4 URL.');
	}

	let count = Math.max(1, Number(process.env.SEED_VIDEO_COUNT) || 40);
	let copyPerRow =
		perRow || (sourceUrls.length > 1 && count > 1);
	if (copyPerRow) count = Math.min(200, count);

	const username = process.env.SEED_CHANNEL_USERNAME?.trim();
	const readyTimeout = Math.max(60_000, Number(process.env.SEED_STREAM_READY_TIMEOUT_MS) || 600_000);

	let channel = username
		? await prisma.channel.findUnique({ where: { username: username.toLowerCase() } })
		: null;

	if (!channel) {
		channel = await prisma.channel.findFirst({ orderBy: { createdAt: 'asc' } });
	}

	if (!channel) {
		throw new Error('No channel found. Create a user/channel first or set SEED_CHANNEL_USERNAME.');
	}

	const tags = (i: number) => TAG_SETS[i % TAG_SETS.length].join(' ');
	const thumbnailImageUrls = resolveThumbnailImageUrls();

	const useCloudflare = !skipCf && accountId && apiToken;

	if (!useCloudflare) {
		const streamUid =
			process.env.SEED_CF_STREAM_UID?.trim() || 'seed-placeholder-no-playback';
		const videoFile = `https://videodelivery.net/${streamUid}/manifest/video.m3u8`;
		const maxDb = Math.min(500, count);

		for (let i = 0; i < maxDb; i++) {
			const title = `Seed video ${i + 1} — ${TAG_SETS[i % TAG_SETS.length][0]}`;
			const thumb =
				thumbnailImageUrls.length > 0
					? thumbnailImageUrls[i % thumbnailImageUrls.length]!
					: `https://picsum.photos/seed/loomio-seed-${i}/1280/720`;
			await prisma.video.create({
				data: {
					title: title.slice(0, 200),
					description: `Synthetic row (no Cloudflare copy). ${i + 1}/${maxDb}.`,
					tags: tags(i),
					visibility: Visibility.public,
					audience: Audience.yes,
					publishType: PublishType.now,
					videoFile,
					videoPublicId: streamUid,
					thumbnailFile: thumb,
					channelId: channel.id,
					likesCount: Math.floor((i * 7 + 3) % 500),
					durationSeconds: 60 + (i % 120),
					createdAt: new Date(Date.now() - i * 3600_000 * (0.5 + (i % 5) * 0.1)),
				},
			});
		}
		console.log(
			`Created ${maxDb} DB-only videos on @${channel.username}. Set CF_ACCOUNT_ID + CF_API_TOKEN and omit SEED_SKIP_CLOUDFLARE to upload to Stream.`,
		);
		return;
	}

	let sharedUid: string | null = null;

	if (!copyPerRow) {
		console.log('Copying once to Cloudflare Stream (many DB rows reuse same uid)…');
		sharedUid = await streamCopyFromUrl(
			accountId!,
			apiToken!,
			sourceUrls[0]!,
			'loomio-seed-template',
		);
		console.log(`Stream uid: ${sharedUid}, waiting until ready…`);
		await waitForStreamReady(accountId!, apiToken!, sharedUid, readyTimeout);
	} else if (sourceUrls.length > 1 && !perRow) {
		console.log(
			`Multiple source URLs (${sourceUrls.length}): using separate Stream copy per row (same as SEED_STREAM_PER_ROW=1).`,
		);
	}

	const maxDb = copyPerRow ? count : Math.min(500, count);

	for (let i = 0; i < maxDb; i++) {
		let uid = sharedUid!;

		if (copyPerRow) {
			const rowSource = sourceUrls[i % sourceUrls.length]!;
			console.log(`[${i + 1}/${maxDb}] Stream copy from ${rowSource.slice(0, 64)}…`);
			uid = await streamCopyFromUrl(
				accountId!,
				apiToken!,
				rowSource,
				`loomio-seed-${i + 1}`,
			);
			await waitForStreamReady(accountId!, apiToken!, uid, readyTimeout);
			await new Promise((r) => setTimeout(r, 600));
		}

		const videoFile = `https://videodelivery.net/${uid}/manifest/video.m3u8`;
		const thumb =
			thumbnailImageUrls.length > 0
				? thumbnailImageUrls[i % thumbnailImageUrls.length]!
				: `https://videodelivery.net/${uid}/thumbnails/thumbnail.jpg?height=720`;
		const title = `Seed video ${i + 1} — ${TAG_SETS[i % TAG_SETS.length][0]}`;

		await prisma.video.create({
			data: {
				title: title.slice(0, 200),
				description: `Seeded via Cloudflare Stream. Index ${i + 1}/${maxDb}.`,
				tags: tags(i),
				visibility: Visibility.public,
				audience: Audience.yes,
				publishType: PublishType.now,
				videoFile,
				videoPublicId: uid,
				thumbnailFile: thumb,
				channelId: channel.id,
				likesCount: Math.floor((i * 7 + 3) % 500),
				durationSeconds: null,
				createdAt: new Date(Date.now() - i * 3600_000 * (0.5 + (i % 5) * 0.1)),
			},
		});
	}

	console.log(
		`Done: ${maxDb} videos on @${channel.username} (${copyPerRow ? 'uid per row' : 'single uid'})`,
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
