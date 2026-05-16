import * as argon2 from 'argon2';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

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

function syntheticSeedVideoWhere(): Prisma.VideoWhereInput {
	return {
		OR: [
			{ title: { startsWith: 'Додаткове відео' } },
			{ title: { startsWith: 'Seed video' } },
			{ description: { contains: 'Автоматично додано сідом' } },
			{ description: { contains: 'Демо-контент для перегляду стрічки' } },
			{ description: { contains: 'Seeded via Cloudflare Stream' } },
			{ description: { contains: 'Synthetic row (no Cloudflare copy)' } },
			{ description: { contains: 'Синтетичне відео для алгоритмів' } },
			{ videoPublicId: 'seed-placeholder-algo' },
			{ videoPublicId: 'seed-placeholder-no-playback' },
			{ videoFile: { contains: 'seed-placeholder' } },
		],
	};
}

function randInt(lo: number, hi: number): number {
	return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function shuffle<T>(arr: T[]): T[] {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j]!, a[i]!];
	}
	return a;
}

function randIp(): string {
	return `${randInt(10, 99)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
}

const UAS = [
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.2 Safari/605.1.15',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
	'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
];

async function main() {
	loadDotenvFromBackendRoot();

	const fanTarget = Math.max(
		50,
		Math.min(5000, Number(process.env.SEED_ENGAGE_FAN_COUNT) || 800),
	);
	const minF = Math.max(
		0,
		Math.min(5000, Number(process.env.SEED_ENGAGE_MIN_FOLLOWERS_PER_CH) || 40),
	);
	const maxF = Math.max(
		minF,
		Math.min(5000, Number(process.env.SEED_ENGAGE_MAX_FOLLOWERS_PER_CH) || 220),
	);
	const minV = Math.max(
		0,
		Math.min(100_000, Number(process.env.SEED_ENGAGE_MIN_VIEWS_PER_VIDEO) || 120),
	);
	const maxV = Math.max(
		minV,
		Math.min(200_000, Number(process.env.SEED_ENGAGE_MAX_VIEWS_PER_VIDEO) || 4500),
	);
	const loggedRatio = Math.max(
		0,
		Math.min(1, Number(process.env.SEED_ENGAGE_LOGGED_VIEW_RATIO) || 0.12),
	);
	const batchSize = Math.max(
		100,
		Math.min(5000, Number(process.env.SEED_ENGAGE_BATCH) || 1500),
	);

	const password =
		process.env.SEED_SYNTH_PASSWORD?.trim() ||
		process.env.SEED_ENGAGE_PASSWORD?.trim() ||
		'TestSynthAlgo!42';
	const hashedPassword = await argon2.hash(password);

	const videos = await prisma.video.findMany({
		where: syntheticSeedVideoWhere(),
		select: { id: true, channelId: true, createdAt: true },
	});

	if (videos.length === 0) {
		console.log(
			'Немає відео за маркерами сідів — спочатку seed:synthetic / seed:videos / seed:extra-channels.',
		);
		return;
	}

	const channels = await prisma.channel.findMany({
		where: { videos: { some: syntheticSeedVideoWhere() } },
		select: { id: true, userId: true, username: true },
	});

	console.log(
		`Цільові відео: ${videos.length}, каналів: ${channels.length}, фан-акаунтів (ціль): ${fanTarget}`,
	);

	for (let i = 0; i < fanTarget; i++) {
		const email = `seedfan.${i}@seed.loomi.local`;
		const username = `seedfan${String(i).padStart(6, '0')}`.slice(0, 39);
		await prisma.user.upsert({
			where: { email },
			update: {},
			create: {
				name: `Глядач ${i + 1}`.slice(0, 255),
				username,
				email,
				password: hashedPassword,
				role: 'USER',
				isActive: true,
				uiPreference: { create: { theme: 'BLUE' } },
			},
		});
	}

	const fanRows = await prisma.user.findMany({
		where: {
			email: { startsWith: 'seedfan.', endsWith: '@seed.loomi.local' },
		},
		select: { id: true },
		orderBy: { email: 'asc' },
	});
	const fanIds = fanRows.map((r) => r.id);

	let followRows = 0;
	for (const ch of channels) {
		const want = randInt(minF, maxF);
		const eligible = shuffle(fanIds.filter((id) => id !== ch.userId));
		const take = Math.min(want, eligible.length);
		if (take === 0) continue;
		const data = eligible.slice(0, take).map((followerId) => ({
			followerId,
			channelId: ch.id,
		}));
		const r = await prisma.channelFollow.createMany({
			data,
			skipDuplicates: true,
		});
		followRows += r.count;
	}

	if (process.env.SEED_ENGAGE_RESET_VIEWS === '1') {
		const del = await prisma.videoView.deleteMany({
			where: { video: syntheticSeedVideoWhere() },
		});
		console.log(`Скинуто старі перегляди для цих відео: ${del.count}`);
	}

	let viewRows = 0;
	const videoIds = videos.map((v) => v.id);
	const byId = new Map(videos.map((v) => [v.id, v] as const));

	let buffer: Prisma.VideoViewCreateManyInput[] = [];

	const flush = async () => {
		if (buffer.length === 0) return;
		const chunk = buffer;
		buffer = [];
		await prisma.videoView.createMany({ data: chunk });
		viewRows += chunk.length;
	};

	const now = Date.now();
	for (const vid of videoIds) {
		const meta = byId.get(vid)!;
		const n = randInt(minV, maxV);
		const start = meta.createdAt.getTime();
		const span = Math.max(60_000, now - start);

		for (let k = 0; k < n; k++) {
			const useUser = fanIds.length > 0 && Math.random() < loggedRatio;
			const userId = useUser ? fanIds[randInt(0, fanIds.length - 1)]! : null;
			buffer.push({
				videoId: vid,
				userId,
				ip: randIp(),
				userAgent: UAS[k % UAS.length]!,
				createdAt: new Date(start + Math.floor(Math.random() * span)),
			});
			if (buffer.length >= batchSize) await flush();
		}
	}
	await flush();

	console.log(
		`Готово: нових підписок (рядків, skipDuplicates): ${followRows}; додано переглядів: ${viewRows}.`,
	);
	console.log(
		'Повторний запуск додає ще перегляди, якщо не встановити SEED_ENGAGE_RESET_VIEWS=1. Підписки дублюються лише на нові пари (skipDuplicates).',
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
