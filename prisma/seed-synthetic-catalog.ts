import * as argon2 from 'argon2';
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

type Topic = {
	slug: string;
	handle: string;
	channelNames: string[];
	description: string;
	creatorNames: string[];
	titles: string[];
	tagSets: string[][];
};

const TOPICS: Topic[] = [
	{
		slug: 'game',
		handle: 'lvl',
		channelNames: [
			'Піксельний плей',
			'Нічні катки',
			'Ґеймерський куточок',
			'Консоль і ПК',
			'Соло-кампанія',
		],
		description: 'Стріми, гайди та огляди відеоігор.',
		creatorNames: ['Олег Стрім', 'Марта Play', 'Діма FPS', 'Світлана RPG'],
		titles: [
			'Фінальний бос без жодної поразки',
			'Патч змінив мету — розбираємо всі правки',
			'Гайд для новачків: з чого почати',
			'Кооп з друзями: проходимо новий рейд',
			'Тір-лист зброї цього сезону',
			'Indie на вечір: що варто купити',
		],
		tagSets: [
			['gaming', 'guide'],
			['esports', 'fps'],
			['rpg', 'boss'],
			['indie', 'review'],
		],
	},
	{
		slug: 'music',
		handle: 'mel',
		channelNames: [
			'Мелодія з Києва',
			'Живий звук',
			'Студія на Набережній',
			'Акустика вдома',
			'Український саунд',
		],
		description: 'Кавери, лайви та музичні добірки.',
		creatorNames: ['Андрій Мікс', 'Катя Вокал', 'Ірина Live', 'Тарас Бас'],
		titles: [
			'Кавер у студії: один дубль',
			'Розбір аранжування улюбленого треку',
			'Живий виступ без автотюну',
			'Плейлист на вечір п’ятниці',
			'Репетиція перед концертом',
			'Як записати вокал у домашніх умовах',
		],
		tagSets: [
			['music', 'cover'],
			['ukrainian', 'live'],
			['acoustic', 'vocal'],
			['band', 'studio'],
		],
	},
	{
		slug: 'news',
		handle: 'dn',
		channelNames: [
			'Ранкова стрічка',
			'Дайджест дня',
			'Факти коротко',
			'Що важливого',
			'Тиждень у цифрах',
		],
		description: 'Події, огляди та пояснення без зайвого шуму.',
		creatorNames: ['Редакція ранку', 'Віктор Аналіз', 'Оксана Дайджест'],
		titles: [
			'Ранковий огляд головних тем',
			'Що змінилось за добу',
			'Експерт пояснює наслідки',
			'Факти проти чуток',
			'Підсумок тижня у десяти хвилинах',
			'Коротко про економіку для «не економістів»',
		],
		tagSets: [
			['news', 'world'],
			['politics', 'brief'],
			['economy', 'analysis'],
			['tech', 'digest'],
		],
	},
	{
		slug: 'tech',
		handle: 'gc',
		channelNames: [
			'Ґаджет-гід',
			'Софт і залізо',
			'Робочий стіл 2.0',
			'AI для щодня',
			'Огляди без води',
		],
		description: 'Ґаджети, програми та все, що клацає.',
		creatorNames: ['Максим Tech', 'Юля Ґаджет', 'Павло Код'],
		titles: [
			'Чесний огляд смартфона після місяця',
			'Порівняння флагманів: що обрати',
			'Лайфхаки ОС, які реально економлять час',
			'Нейромережі на практиці: з чого почати',
			'Сетап столу під роботу та відпочинок',
			'Чи варте оновлення: радимо та не радимо',
		],
		tagSets: [
			['tech', 'review'],
			['software', 'tips'],
			['hardware', 'unbox'],
			['ai', 'tutorial'],
		],
	},
	{
		slug: 'cook',
		handle: 'smk',
		channelNames: [
			'Смакодім',
			'Кухня вихідного дня',
			'Швидко й ситно',
			'Домашня випічка',
			'Сезонний кошик',
		],
		description: 'Рецепти та ідеї для щоденного столу.',
		creatorNames: ['Настя Смак', 'Баба Галина Стиль', 'Шеф Ігор'],
		titles: [
			'Сніданок за п’ятнадцять хвилин',
			'Пиріг, який не обдуре',
			'Соус без вершків: простий рецепт',
			'Обід у ланчбоксі',
			'Що готувати з сезонних овочів',
			'Вечеря без мороки після роботи',
		],
		tagSets: [
			['cooking', 'recipe'],
			['baking', 'easy'],
			['vegan', 'healthy'],
			['comfort', 'family'],
		],
	},
	{
		slug: 'sport',
		handle: 'trb',
		channelNames: [
			'Трибуна',
			'Матч-день',
			'Зал без виправдань',
			'Огляди туру',
			'Фан-зона',
		],
		description: 'Моменти матчів, розбір тактики та тренування.',
		creatorNames: ['Коментатор Роман', 'Коуч Сергій', 'Аня Фан'],
		titles: [
			'Найяскравіші моменти туру',
			'Тактика команди з пташиного пеліна',
			'Тренування вдома без тренажерів',
			'Трансферні чутки: що правда, що ні',
			'Постматчеве інтерв’ю: головні тези',
			'Як не травмуватися на пробіжці',
		],
		tagSets: [
			['sport', 'highlights'],
			['football', 'match'],
			['fitness', 'training'],
			['basketball', 'analysis'],
		],
	},
	{
		slug: 'edu',
		handle: 'edu',
		channelNames: [
			'Лекторій простими словами',
			'Шпаргалка',
			'Підготовка до сесії',
			'Математика без страху',
			'Диплом не страшний',
		],
		description: 'Уроки, пояснення та лайфхаки для навчання.',
		creatorNames: ['Викладач Оля', 'Репетитор Микола', 'Студка Ксенія'],
		titles: [
			'Пояснюю тему за двадцять хвилин',
			'Розбір типової задачі з іспиту',
			'Шпаргалка перед контрольною',
			'Міфи про предмет, у які не варто вірити',
			'Q&A: відповідаю на ваші питання',
			'Як не згоріти перед дедлайном',
		],
		tagSets: [
			['education', 'lecture'],
			['math', 'explained'],
			['science', 'exam'],
			['language', 'practice'],
		],
	},
	{
		slug: 'travel',
		handle: 'way',
		channelNames: [
			'Дорога назустріч',
			'Вікенд у Європі',
			'Бюджетний трип',
			'Місцеві смаколики',
			'Валіза за п’ять хвилин',
		],
		description: 'Маршрути, бюджет і поради мандрівникам.',
		creatorNames: ['Мандрівник Вадим', 'Ліза Карта', 'Блог Оксани'],
		titles: [
			'Вікенд у місті: скільки взяти грошей',
			'Хостел чи готель: чесне порівняння',
			'Топ місць, які не крутять у рекламі',
			'Де смачно поїсти без туристичних пасток',
			'Коли купувати авіаквитки вигідніше',
			'Маршрут на три дні без метушні',
		],
		tagSets: [
			['travel', 'budget'],
			['europe', 'city'],
			['backpack', 'tips'],
			['photo', 'vlog'],
		],
	},
];

function tagsFor(topic: Topic, videoIndex: number): string {
	const set = topic.tagSets[videoIndex % topic.tagSets.length]!;
	return set.join(' ');
}

const DEFAULT_SYNTH_MP4 =
	'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4';

async function main() {
	loadDotenvFromBackendRoot();

	const nCh = Math.max(1, Math.min(500, Number(process.env.SEED_SYNTH_CHANNELS) || 8));
	const nVid = Math.max(1, Math.min(200, Number(process.env.SEED_SYNTH_VIDEOS_PER_CH) || 8));
	const offset = Math.max(0, Number(process.env.SEED_SYNTH_OFFSET) || 0);
	const password =
		process.env.SEED_SYNTH_PASSWORD?.trim() || 'TestSynthAlgo!42';

	const useStreamPlaceholder =
		process.env.SEED_SYNTH_USE_STREAM_PLACEHOLDER === '1';
	const streamUid =
		process.env.SEED_SYNTH_CF_UID?.trim() || 'seed-placeholder-algo';
	let demoUrlRaw = process.env.SEED_SYNTH_DEMO_MP4_URL?.trim()
	if (
		demoUrlRaw &&
		/gtv-videos-bucket|ForBiggerEscapes|googleapis\.com\/gtv-|videos\.pexels\.com|pexels\.com\/video-files/i.test(
			demoUrlRaw,
		)
	) {
		demoUrlRaw = undefined
	}
	const demoMp4 = (demoUrlRaw || DEFAULT_SYNTH_MP4).slice(0, 255);
	const streamManifest = `https://videodelivery.net/${streamUid}/manifest/video.m3u8`.slice(
		0,
		255,
	);
	const videoFileBase = useStreamPlaceholder ? streamManifest : demoMp4;
	const videoPublicId = useStreamPlaceholder ? streamUid : null;

	const hashedPassword = await argon2.hash(password);

	for (let i = 0; i < nCh; i++) {
		const globalIdx = offset + i;
		const topic = TOPICS[i % TOPICS.length]!;

		const chDisplay =
			topic.channelNames[globalIdx % topic.channelNames.length] ?? topic.channelNames[0]!;
		const creatorName =
			topic.creatorNames[globalIdx % topic.creatorNames.length] ?? topic.creatorNames[0]!;

		const userSlug = `${topic.handle}dev${globalIdx}`.replace(/[^a-z0-9]/gi, '').slice(0, 39);
		const userUsername = userSlug.length >= 3 ? userSlug : `u${topic.handle}${globalIdx}`.slice(0, 39);
		const userEmail = `demo.${topic.handle}.${globalIdx}@seed.loomi.local`;
		const chUsername = `${topic.handle}${globalIdx}`.slice(0, 20);
		const chName = chDisplay.slice(0, 50);

		const user = await prisma.user.create({
			data: {
				name: creatorName.slice(0, 255),
				username: userUsername,
				email: userEmail,
				password: hashedPassword,
				role: 'USER',
				isActive: true,
				avatarUrl: `https://picsum.photos/seed/algo-av-${globalIdx}/128/128`,
				uiPreference: {
					create: { theme: 'BLUE' },
				},
			},
		});

		const channel = await prisma.channel.create({
			data: {
				name: chName,
				username: chUsername,
				description: topic.description.slice(0, 2000),
				isDefault: true,
				userId: user.id,
				avatarUrl: `https://picsum.photos/seed/algo-ch-${globalIdx}/200/200`,
				bannerUrl: `https://picsum.photos/seed/algo-bn-${globalIdx}/1280/320`,
			},
		});

		for (let v = 0; v < nVid; v++) {
			const titleBase = topic.titles[v % topic.titles.length]!;
			const title = `Випуск ${v + 1}: ${titleBase}`.slice(0, 200);
			const createdAt = new Date(Date.now() - (i * 90 + v * 12) * 60_000);
			await prisma.video.create({
				data: {
					title,
					description:
						`${chDisplay}: ${titleBase}\n\nДемо-контент для перегляду стрічки та рекомендацій.`.slice(
							0,
							5000,
						),
					tags: tagsFor(topic, v),
					visibility: Visibility.public,
					audience: Audience.yes,
					publishType: PublishType.now,
					videoFile: videoFileBase,
					videoPublicId,
					thumbnailFile: `https://picsum.photos/seed/algo-v-${globalIdx}-${v}/1280/720`,
					channelId: channel.id,
					likesCount: (globalIdx * 41 + v * 17) % 8000,
					dislikesCount: (globalIdx * 3 + v) % 120,
					durationSeconds: 60 + ((globalIdx + v) % 600),
					createdAt,
				},
			});
		}

		console.log(`OK @${channel.username}: ${nVid} videos (topic ${topic.slug})`);
	}

	console.log(
		`\nDone: ${nCh} channels, ${nCh * nVid} videos. Канали: @username у форматі <ніша><номер>, наприклад @${TOPICS[0]!.handle}${offset}, @${TOPICS[1]!.handle}${offset + 1}, …`,
	);
	console.log(
		`Користувачі: username на кшталт ${TOPICS[0]!.handle}dev${offset}, email demo.${TOPICS[0]!.handle}.${offset}@seed.loomi.local — пароль той самий.`,
	);
	console.log(
		useStreamPlaceholder
			? 'Відтворення: плейсхолдер Stream (потрібен реальний CF uid).'
			: `Відтворення: один MP4 для всіх нових відео → ${demoMp4.slice(0, 72)}…`,
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
