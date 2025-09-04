import * as crypto from 'crypto';

export function generateCode(isToken: boolean = false): string {
	if (isToken) return crypto.randomBytes(32).toString('hex');

	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let code = '';

	for (let i = 0; i < 6; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}

	return code;
}

export function hashSecret(value: string): string {
	return crypto.createHash('sha256').update(value).digest('hex');
}
