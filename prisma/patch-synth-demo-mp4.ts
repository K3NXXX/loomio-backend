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

const DEFAULT_SYNTH_MP4 =
	'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4';

const prisma = new PrismaClient();

async function main() {
	loadDotenvFromBackendRoot();

	let fromEnv = process.env.SEED_SYNTH_DEMO_MP4_URL?.trim()
	if (
		fromEnv &&
		/gtv-videos-bucket|ForBiggerEscapes|googleapis\.com\/gtv-|videos\.pexels\.com|pexels\.com\/video-files/i.test(
			fromEnv,
		)
	) {
		fromEnv = undefined
	}
	const url = (fromEnv || DEFAULT_SYNTH_MP4).slice(0, 255);

	const r = await prisma.video.updateMany({
		where: {
			OR: [
				{
					description: {
						contains: 'Демо-контент для перегляду стрічки та рекомендацій',
					},
				},
				{ videoFile: { contains: 'gtv-videos-bucket' } },
				{ videoFile: { contains: 'ForBiggerEscapes' } },
				{ videoFile: { contains: 'w3schools.com/html/mov_bbb' } },
				{ videoFile: { contains: 'videos.pexels.com' } },
				{ videoFile: { contains: 'pexels.com/video-files' } },
			],
		},
		data: {
			videoFile: url,
			videoPublicId: null,
		},
	});

	console.log(`Оновлено ${r.count} відео → ${url.length > 90 ? url.slice(0, 90) + '…' : url}`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
