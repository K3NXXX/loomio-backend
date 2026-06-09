import { Audience, PrismaClient, PublishType, Visibility } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
			v = v.slice(1, -1);
		}
		if (process.env[k] === undefined) process.env[k] = v;
	}
}

const prisma = new PrismaClient();

const DEFAULT_MP4 =
	'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4';

const GAMING_CHANNELS: {
	name: string;
	description: string;
	videos: { title: string; tags: string }[];
}[] = [
	{
		name: 'FPS Arena UA',
		description: 'Стріми та гайди з шутерів, кіберспорт.',
		videos: [
			{ title: 'Найкращі моменти.ranked матчу', tags: 'gaming fps esports ranked' },
			{ title: 'Налаштування чутливості миші 2026', tags: 'gaming fps guide pc' },
			{ title: 'Огляд нового патчу — мета змістилась', tags: 'gaming fps patch review' },
			{ title: 'Координація з командою у пабліку', tags: 'gaming fps multiplayer tips' },
			{ title: 'Топ-5 зброї для старту сезону', tags: 'gaming fps esports tierlist' },
		],
	},
	{
		name: 'RPG & Story Hub',
		description: 'Проходження RPG, сюжети та сайд-квести.',
		videos: [
			{ title: 'Перші 30 хвилин нової RPG — враження', tags: 'gaming rpg indie firstlook' },
			{ title: 'Секретна кінцівка без спойлерів', tags: 'gaming rpg story endings' },
			{ title: 'Гайд по збірці класу «мічник»', tags: 'gaming rpg guide build' },
			{ title: 'Indie-гем, якому дали шанс', tags: 'gaming indie rpg review' },
			{ title: 'Що грати у вікенд: три короткі RPG', tags: 'gaming rpg picks weekend' },
		],
	},
	{
		name: 'Strategy & Sims Lab',
		description: 'Покрокові стратегії, менеджмент, симулятори.',
		videos: [
			{
				title: 'Старт у глобальній стратегії для новачків',
				tags: 'gaming strategy guide tutorial',
			},
			{ title: 'Економіка за 10 ходів — не прогоріти', tags: 'gaming strategy economy tips' },
			{ title: 'Новий тактичний роглайк — чи варто', tags: 'gaming strategy roguelike review' },
			{ title: 'Будуємо місто мрії (симулятор)', tags: 'gaming sim city builder relaxing' },
			{ title: 'Мультиплеєр 2v2: базовий план', tags: 'gaming strategy multiplayer team' },
		],
	},
];

async function main() {
	loadDotenvFromBackendRoot();

	const batch = crypto.randomBytes(3).toString('hex');
	const password = process.env.SEED_GAMING_PASSWORD?.trim() || 'GamingDemo!2026';
	const hashedPassword = await argon2.hash(password);
	const videoFile = (process.env.SEED_GAMING_DEMO_MP4_URL?.trim() || DEFAULT_MP4).slice(0, 255);

	const created: { channel: string; user: string; email: string }[] = [];

	for (let i = 0; i < GAMING_CHANNELS.length; i++) {
		const def = GAMING_CHANNELS[i]!;
		const chUsername = `gm${batch}${i + 1}`.slice(0, 20);
		const userUsername = `ugm${batch}${i + 1}`.slice(0, 39);
		const email = `gaming.${batch}.${i + 1}@demo.loomi.local`;

		const user = await prisma.user.create({
			data: {
				name: def.name.slice(0, 255),
				username: userUsername,
				email,
				password: hashedPassword,
				role: 'USER',
				isActive: true,
				avatarUrl: `https://picsum.photos/seed/gaming-u-${batch}-${i}/128/128`,
				uiPreference: {
					create: { theme: 'BLUE', appearance: 'DARK', locale: 'UK' },
				},
			},
		});

		const channel = await prisma.channel.create({
			data: {
				name: def.name.slice(0, 50),
				username: chUsername,
				description: def.description.slice(0, 2000),
				isDefault: true,
				userId: user.id,
				avatarUrl: `https://picsum.photos/seed/gaming-ch-${batch}-${i}/200/200`,
				bannerUrl: `https://picsum.photos/seed/gaming-bn-${batch}-${i}/1280/320`,
			},
		});

		for (let v = 0; v < def.videos.length; v++) {
			const row = def.videos[v]!;
			await prisma.video.create({
				data: {
					title: row.title.slice(0, 200),
					description: `Демо ігрового каналу «${def.name}» для тестів рекомендацій і пошуку.`.slice(
						0,
						2000,
					),
					tags: row.tags.slice(0, 500),
					visibility: Visibility.public,
					audience: Audience.no,
					publishType: PublishType.now,
					videoFile,
					videoPublicId: null,
					thumbnailFile: `https://picsum.photos/seed/gv-${batch}-${i}-${v}/1280/720`.slice(0, 255),
					channelId: channel.id,
					likesCount: (i * 200 + v * 73) % 5000,
					dislikesCount: (i * 5 + v) % 80,
					durationSeconds: 120 + (((i + v) * 37) % 400),
					createdAt: new Date(Date.now() - (i * 120 + v * 45) * 60_000),
				},
			});
		}

		created.push({ channel: chUsername, user: userUsername, email });
	}

	console.log('\n--- Gaming demo seed ---');
	console.log(`Batch id: ${batch}`);
	console.log(`Password (all 3 users): ${password}`);
	for (const c of created) {
		console.log(`  @${c.channel} → user ${c.user}, ${c.email}`);
	}
	console.log(`Videos: ${GAMING_CHANNELS.reduce((n, g) => n + g.videos.length, 0)} total`);
	console.log('------------------------\n');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => void prisma.$disconnect());
