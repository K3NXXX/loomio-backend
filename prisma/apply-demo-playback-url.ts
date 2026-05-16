import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

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

const DEFAULT_MP4 =
	'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4';

async function main() {
	loadDotenvFromBackendRoot();

	const url = (
		process.env.DEMO_PLAYBACK_MP4_URL?.trim() || DEFAULT_MP4
	).slice(0, 255);

	if (!url.startsWith('http')) {
		throw new Error('DEMO_PLAYBACK_MP4_URL має бути https://... до прямого .mp4');
	}

	const onlyPlaceholder = process.env.DEMO_PATCH_ONLY_PLACEHOLDER !== '0';

	const where = onlyPlaceholder
		? {
				OR: [
					{ videoPublicId: 'seed-placeholder-algo' },
					{ videoPublicId: 'seed-placeholder-no-playback' },
					{ videoFile: { contains: 'seed-placeholder' } },
					{ videoFile: { contains: 'videodelivery.net/seed-' } },
				] as const,
			}
		: {};

	const result = await prisma.video.updateMany({
		where,
		data: {
			videoFile: url,
			videoPublicId: null,
		},
	});

	console.log(
		onlyPlaceholder
			? `Оновлено ${result.count} відео (лише плейсхолдери). videoFile = ${url.slice(0, 72)}…`
			: `Оновлено ${result.count} відео (усі рядки). videoFile = ${url.slice(0, 72)}…`,
	);
	console.log('Відкрий будь-яке відео на /watch — має грати цей MP4.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
