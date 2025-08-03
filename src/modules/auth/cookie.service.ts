import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CookieOptions, Response } from "express";

@Injectable()
export class CookieService {
  constructor(private readonly configService: ConfigService) {}

  private isProd(): boolean {
    return this.configService.get<string>("NODE_ENV") === "production";
  }

  private baseOptions(httpOnly = true): CookieOptions {
    return {
      httpOnly,
      secure: this.isProd(),
      sameSite: this.isProd() ? "none" : "lax",
      path: "/",
    };
  }

  setCookies(res: Response, accessToken: string, refreshToken: string) {
    const refreshExpiresDays = this.configService.getOrThrow<number>(
      "REFRESH_TOKEN_EXPIRES",
    );
    const accessExpiresMs = this.configService.getOrThrow<number>(
      "ACCESS_TOKEN_EXPIRES",
    );

    if (isNaN(refreshExpiresDays) || isNaN(accessExpiresMs))
      throw new Error("Invalid token expiration config values");

    res.cookie("accessToken", accessToken, {
      ...this.baseOptions(true),
      maxAge: accessExpiresMs,
    });

    res.cookie("refreshToken", refreshToken, {
      ...this.baseOptions(true),
      expires: new Date(Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000),
    });
  }

  clearCookies(res: Response) {
    if (!res || typeof res.cookie !== "function")
      throw new Error("Invalid response object");

    const expired = {
      ...this.baseOptions(true),
      expires: new Date(0),
    };

    res.cookie("accessToken", "", expired);
    res.cookie("refreshToken", "", expired);
  }

  setThemeCookie(res: Response, theme: string) {
    res.cookie("theme", theme, {
      ...this.baseOptions(false),
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
  }

  clearThemeCookie(res: Response) {
    res.cookie("theme", "", {
      ...this.baseOptions(false),
      expires: new Date(0),
    });
  }
}
