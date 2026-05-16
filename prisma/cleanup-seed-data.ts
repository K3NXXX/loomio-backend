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

function parseKeepList(): string[] {
	const raw =
		process.env.SEED_CLEANUP_KEEP_USERNAMES?.trim() || 'worldgames,metalwrld';
	return raw
		.split(/[,;\n]+/)
		.map((s) => s.trim().replace(/^@/, '').toLowerCase())
		.filter(Boolean);
}

function junkVideoWhere(): Prisma.VideoWhereInput {
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

async function main() {
	loadDotenvFromBackendRoot();

	const keep = parseKeepList();
	const dry = process.env.SEED_CLEANUP_DRY_RUN === '1';

	if (keep.length === 0) {
		throw new Error('SEED_CLEANUP_KEEP_USERNAMES порожній — відмова (захист від повного вайпу).');
	}

	const removeChannels = await prisma.channel.findMany({
		where: { username: { notIn: keep } },
		select: { id: true, username: true },
	});

	const junkCount = await prisma.video.count({ where: junkVideoWhere() });

	console.log(`Залишаємо канали: @${keep.join(', @')}`);
	console.log(`Каналів до видалення: ${removeChannels.length} (${removeChannels.map((c) => c.username).join(', ') || '—'})`);
	console.log(`Відео «сідні» (за шаблоном) у всій БД: ${junkCount}`);

	if (dry) {
		console.log('\n[Dry run] Нічого не видалено.');
		return;
	}

	const removeIds = removeChannels.map((c) => c.id);

	await prisma.playlist.updateMany({
		where: { channelId: { in: removeIds } },
		data: { channelId: null },
	});

	const deletedJunkVideos = await prisma.video.deleteMany({
		where: junkVideoWhere(),
	});
	console.log(`Видалено відео (сід / плейсхолдер): ${deletedJunkVideos.count}`);

	const deletedCh = await prisma.channel.deleteMany({
		where: { id: { in: removeIds } },
	});
	console.log(`Видалено каналів: ${deletedCh.count}`);

	const deletedUsers = await prisma.user.deleteMany({
		where: {
			role: 'USER',
			channels: { none: {} },
			OR: [
				{ email: { endsWith: '@seed.loomi.local' } },
				{ email: { endsWith: '@test.loomi.local' } },
				{ username: { startsWith: 'algouser_' } },
			],
		},
	});
	console.log(`Видалено «сідних» користувачів без каналів: ${deletedUsers.count}`);

	console.log('\nГотово.');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
