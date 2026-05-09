import { User } from '@prisma/client';
import { Request } from 'express';

export interface RequestWithOptionalUser extends Request {
	user?: User | null;
}
