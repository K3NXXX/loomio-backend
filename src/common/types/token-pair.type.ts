import { User } from "@prisma/client";

export interface TokenPair {
  user: Omit<User, "password">;
  accessToken: string;
  refreshToken: string;
}
