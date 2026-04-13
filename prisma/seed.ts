import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
	console.log('🌱 Starting seed...');

	const adminEmail = 'admin@loomio.com';
	const adminPassword = 'admin123456789';
	const hashedPassword = await argon2.hash(adminPassword);

	const admin = await prisma.user.upsert({
		where: { email: adminEmail },
		update: {},
		create: {
			name: 'Super Admin',
			username: 'superadmin',
			email: adminEmail,
			password: hashedPassword,
			role: 'ADMIN',
			isActive: true,
			theme: 'BLUE',
		},
	});

	console.log('✔ Admin created/exists:', admin.email);

	const defaultChannel = await prisma.channel.upsert({
		where: { username: 'admin-channel' },
		update: {},
		create: {
			name: 'Admin Channel',
			username: 'admin-channel',
			description: 'Default admin channel',
			isDefault: true,
			userId: admin.id,
		},
	});

	console.log('✔ Admin default channel created/exists:', defaultChannel.username);

	console.log('🌱 Seed completed successfully!');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
