import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import {
  Profile,
  Strategy,
  StrategyOptions,
  VerifyCallback,
} from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    const options: StrategyOptions = {
      clientID: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? "",
      scope: ["email", "profile"],
    };

    super(options);
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const { id, emails, name, photos } = profile;

    const email = emails?.[0]?.value ?? null;

    const fullName =
      `${name?.givenName ?? ""} ${name?.familyName ?? ""}`.trim();

    const user = {
      provider: "google",
      providerId: id,
      email,
      name: fullName,
      username: email ? email.split("@")[0] : null,
      avatarUrl: photos?.[0]?.value ?? null,
    };

    done(null, user);
  }
}
