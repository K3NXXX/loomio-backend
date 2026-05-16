-- Remove banner_animated; GIF vs static is implied by file, Premium is enforced on upload only.
ALTER TABLE "channels" DROP COLUMN IF EXISTS "banner_animated";
