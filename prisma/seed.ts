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
			uiPreference: {
				create: {
					theme: 'BLUE',
				},
			},
		},
	});

	console.log('Admin created/exists:', admin.email);

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

	console.log('Admin default channel created/exists:', defaultChannel.username);

	const demoEmail = 'user@loomio.com';
	const demoPassword = 'user123456789';
	const demoUserHash = await argon2.hash(demoPassword);

	const demoUser = await prisma.user.upsert({
		where: { email: demoEmail },
		update: {},
		create: {
			name: 'Demo User',
			username: 'demouser',
			email: demoEmail,
			password: demoUserHash,
			role: 'USER',
			isActive: true,
			uiPreference: {
				create: {
					theme: 'BLUE',
				},
			},
		},
	});

	console.log('Demo user created/exists:', demoUser.email, '(username: demouser)');

	await prisma.channel.upsert({
		where: { username: 'demo-user-channel' },
		update: {},
		create: {
			name: 'Demo User Channel',
			username: 'demo-user-channel',
			description: 'Default channel for demo user',
			isDefault: true,
			userId: demoUser.id,
		},
	});

	console.log('\n--- Login (regular USER, not admin) ---');
	console.log('Email or username:', demoEmail, '| demouser');
	console.log('Password:', demoPassword);
	console.log('----------------------------------------\n');

	console.log('Seed completed successfully!');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
