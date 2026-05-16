-- CreateEnum
CREATE TYPE "AppearanceMode" AS ENUM ('LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "appearance" "AppearanceMode" NOT NULL DEFAULT 'DARK';
