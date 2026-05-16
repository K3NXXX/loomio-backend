-- AlterEnum — user-defined palette (Premium)
ALTER TYPE "ThemeColors" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "custom_theme" JSONB;
