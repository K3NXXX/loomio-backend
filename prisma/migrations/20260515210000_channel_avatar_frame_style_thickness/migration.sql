-- AlterTable
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "avatar_frame_thickness" VARCHAR(10);
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "avatar_frame_style" VARCHAR(20);
