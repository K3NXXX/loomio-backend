import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const KEY = 'role';

export const Role = (...role: UserRole[]) => SetMetadata(KEY, role);
