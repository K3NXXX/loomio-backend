import { User } from '@prisma/client';
import { Request } from 'express';

export type RequestWithOptionalUser = Omit<Request, 'user'> & {
	user?: User | null;
};
