/**
 * One-off: create a random USER for manual testing (login / home feed).
 * Run from repo root: npx ts-node prisma/seed-test-user.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { argon2id, hash } from 'argon2';

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

loadDotenvFromBackendRoot();

const prisma = new PrismaClient();

async function main() {
	const suffix = Math.random().toString(36).slice(2, 10);
	const email = `tester_${suffix}@loomio.local`;
	const username = `t_${suffix}`.slice(0, 20);
	const password = `Test!${suffix}Aa1`;

	const passwordHash = await hash(password, { type: argon2id });

	const user = await prisma.user.create({
		data: {
			name: 'Test user',
			username,
			email,
			password: passwordHash,
			isActive: true,
			role: 'USER',
			uiPreference: {
				create: {
					theme: 'BLUE',
					appearance: 'DARK',
					locale: 'UK',
				},
			},
		},
	});

	console.log('\n--- Test user created (save these credentials) ---');
	console.log('Email:   ', email);
	console.log('Username:', username);
	console.log('Password:', password);
	console.log('User id: ', user.id);
	console.log('--- Log in with email or username + password ---\n');
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => void prisma.$disconnect());
