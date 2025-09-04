import type { Request } from 'express';
import { getClientIp } from 'request-ip';
import { UAParser } from 'ua-parser-js';

export function extractRequestInfo(req: Request): {
	ip: string;
	userAgent: string;
} {
	const ip = getClientIp(req) || 'unknown';
	const userAgent = new UAParser(req.headers['user-agent'] || '').getUA();
	return { ip, userAgent };
}
