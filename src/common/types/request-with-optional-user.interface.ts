import { User } from '@prisma/client';
import { Request } from 'express';

/** Passport types `user` as `User | undefined` only — `null` must not extend that directly. */
export type RequestWithOptionalUser = Omit<Request, 'user'> & {
	user?: User | null;
};
