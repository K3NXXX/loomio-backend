CREATE TABLE IF NOT EXISTS "channel_brandings" (
  "channel_id" TEXT NOT NULL,
  "avatar_frame_color" VARCHAR(7),
  "avatar_frame_thickness" VARCHAR(10),
  "avatar_frame_style" VARCHAR(20),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "channel_brandings_pkey" PRIMARY KEY ("channel_id")
);

ALTER TABLE "channel_brandings" DROP CONSTRAINT IF EXISTS "channel_brandings_channel_id_fkey";
ALTER TABLE "channel_brandings" ADD CONSTRAINT "channel_brandings_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "channel_brandings" ("channel_id", "avatar_frame_color", "avatar_frame_thickness", "avatar_frame_style", "updated_at")
SELECT c."id", c."avatar_frame_color", c."avatar_frame_thickness", c."avatar_frame_style", CURRENT_TIMESTAMP
FROM "channels" c
WHERE (
  c."avatar_frame_color" IS NOT NULL
  OR c."avatar_frame_thickness" IS NOT NULL
  OR c."avatar_frame_style" IS NOT NULL
)
AND NOT EXISTS (SELECT 1 FROM "channel_brandings" b WHERE b."channel_id" = c."id");

ALTER TABLE "channels" DROP COLUMN IF EXISTS "avatar_frame_color";
ALTER TABLE "channels" DROP COLUMN IF EXISTS "avatar_frame_thickness";
ALTER TABLE "channels" DROP COLUMN IF EXISTS "avatar_frame_style";
