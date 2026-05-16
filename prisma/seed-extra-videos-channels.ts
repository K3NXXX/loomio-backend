import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
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
	['gaming', 'review'],
	['music', 'live'],
	['news', 'brief'],
	['tech', 'tips'],
	['sport', 'highlights'],
];

const DEFAULT_MP4 =
	'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4';

function parseChannelList(): string[] {
	const raw =
		process.env.SEED_EXTRA_CHANNEL_USERNAMES?.trim() ||
		'worldgames,metalwrld';
	return raw
		.split(/[,;\n]+/)
		.map((s) => s.trim().replace(/^@/, '').toLowerCase())
		.filter(Boolean);
}

async function main() {
	loadDotenvFromBackendRoot();

	const usernames = parseChannelList();
	const per = Math.max(1, Math.min(200, Number(process.env.SEED_EXTRA_PER_CHANNEL) || 10));
	const videoFile = (
		process.env.SEED_EXTRA_DEMO_MP4_URL?.trim() || DEFAULT_MP4
	).slice(0, 255);

	const batchSalt = crypto.randomBytes(4).toString('hex');

	for (const username of usernames) {
		const channel = await prisma.channel.findUnique({
			where: { username },
		});

		if (!channel) {
			console.warn(`Пропуск: канал @${username} не знайдено в БД.`);
			continue;
		}

		for (let i = 0; i < per; i++) {
			const tags = TAG_SETS[i % TAG_SETS.length]!.join(' ');
			const title = `Додаткове відео · @${channel.username} №${i + 1}`.slice(0, 200);
			const thumbSeed = `extra-${channel.id}-${batchSalt}-${i}`;

			await prisma.video.create({
				data: {
					title,
					description:
						`Автоматично додано сідом (не чіпає старі відео). Канал @${channel.username}.`.slice(
							0,
							2000,
						),
					tags,
					visibility: Visibility.public,
					audience: Audience.yes,
					publishType: PublishType.now,
					videoFile,
					videoPublicId: null,
					thumbnailFile: `https://picsum.photos/seed/${encodeURIComponent(thumbSeed)}/1280/720`,
					channelId: channel.id,
					likesCount: Math.floor((i * 11 + username.length * 3) % 900),
					dislikesCount: (i * 2) % 40,
					durationSeconds: 90 + (i % 300),
					createdAt: new Date(Date.now() - i * 420_000 - username.charCodeAt(0) * 1000),
				},
			});
		}

		console.log(`OK: +${per} нових відео на @${channel.username} (старі не змінювались).`);
	}

	console.log(`\nГотово. Перегляд: прямий MP4 у videoFile → ${videoFile.slice(0, 64)}…`);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
