-- CreateTable
CREATE TABLE "user_ui_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "theme" "ThemeColors" NOT NULL DEFAULT 'BLUE',
    "custom_theme" JSONB,
    "appearance" "AppearanceMode" NOT NULL DEFAULT 'DARK',
    "locale" "Locale" NOT NULL DEFAULT 'UK',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ui_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_ui_preferences_user_id_key" ON "user_ui_preferences"("user_id");

ALTER TABLE "user_ui_preferences"
  ADD CONSTRAINT "user_ui_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_ui_preferences" ("id", "user_id", "theme", "custom_theme", "appearance", "locale", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "id", "theme", "custom_theme", "appearance", "locale", NOW(), NOW()
FROM "users";

ALTER TABLE "users" DROP COLUMN "theme";
ALTER TABLE "users" DROP COLUMN "custom_theme";
ALTER TABLE "users" DROP COLUMN "appearance";
ALTER TABLE "users" DROP COLUMN "locale";
