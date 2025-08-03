import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { User } from "@prisma/client";
import { omit } from "lodash";

import { TokenPair } from "@/common/types/token-pair.type";

import { SessionService } from "./sessions/sessions.service";

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
  ) {}

  async issueTokens(
    user: User,
    ip: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    const accessToken = await this.createAccessToken(user.id);
    const refreshToken = await this.createRefreshToken(user.id, ip, userAgent);
    const sanitizedUser = omit(user, "password");

    return {
      user: sanitizedUser,
      accessToken,
      refreshToken,
    };
  }

  async createAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId },
      {
        expiresIn: this.configService.get<string>("JWT_ACCESS_EXPIRES_IN"),
        subject: userId,
      },
    );
  }

  private async createRefreshToken(
    userId: string,
    ip: string,
    userAgent?: string,
  ): Promise<string> {
    const ttlDays = this.configService.getOrThrow<number>(
      "REFRESH_TOKEN_EXPIRES",
    );
    const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);

    return this.sessionService.create({ userId, ip, userAgent, expiresAt });
  }
}
