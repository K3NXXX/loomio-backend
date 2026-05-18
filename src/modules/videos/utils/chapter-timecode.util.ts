import { BadRequestException } from '@nestjs/common';

const TC_SHAPE = /^(\d{1,3}:\d{2}:\d{2}|\d{1,3}:\d{2})$/;

export function isValidChapterTimecode(trimmed: string): boolean {
	if (!TC_SHAPE.test(trimmed)) return false;
	const parts = trimmed.split(':').map((p) => Number.parseInt(p, 10));
	if (parts.some((n) => !Number.isFinite(n))) return false;
	if (parts.length === 2) {
		const [m, s] = parts;
		return m >= 0 && m <= 999 && s >= 0 && s <= 59;
	}
	const [h, m, s] = parts;
	return h >= 0 && h <= 999 && m >= 0 && m <= 59 && s >= 0 && s <= 59;
}

export type ChapterPayload = { title: string; timecode: string };

const MAX_CHAPTERS = 40;
const TITLE_MAX = 120;

/** Parse and validate chapters from multipart string or return undefined (no chapters). */
export function parseChaptersJson(raw: string | undefined): ChapterPayload[] | undefined {
	if (raw == null || raw.trim() === '') return undefined;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw) as unknown;
	} catch {
		throw new BadRequestException('Invalid chapters JSON');
	}

	if (!Array.isArray(parsed)) {
		throw new BadRequestException('Chapters must be a JSON array');
	}
	if (parsed.length > MAX_CHAPTERS) {
		throw new BadRequestException(`At most ${MAX_CHAPTERS} chapters allowed`);
	}

	const out: ChapterPayload[] = [];
	for (let i = 0; i < parsed.length; i++) {
		const item = parsed[i];
		if (typeof item !== 'object' || item === null) {
			throw new BadRequestException(`Invalid chapter at index ${i}`);
		}
		const rec = item as Record<string, unknown>;
		const title = String(rec.title ?? '').trim();
		const timecode = String(rec.timecode ?? '').trim();
		if (!title && !timecode) continue;
		if (!title) {
			throw new BadRequestException(`Chapter at index ${i}: title is required`);
		}
		if (!timecode) {
			throw new BadRequestException(`Chapter at index ${i}: timecode is required`);
		}
		if (title.length > TITLE_MAX) {
			throw new BadRequestException(`Chapter title must be at most ${TITLE_MAX} characters`);
		}
		if (!isValidChapterTimecode(timecode)) {
			throw new BadRequestException(
				`Chapter at index ${i}: invalid time (use mm:ss or h:mm:ss, seconds 00–59)`,
			);
		}
		out.push({ title, timecode });
	}

	if (out.length === 0) return undefined;
	return out;
}
