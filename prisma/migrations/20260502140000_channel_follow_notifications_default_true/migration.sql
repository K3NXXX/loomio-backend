-- Default was false, so VIDEO_PUBLISHED matched zero followers → no Notification rows created.
-- New rows use default true via schema + follow.service create.

ALTER TABLE "channel_follows" ALTER COLUMN "notificationsEnabled" SET DEFAULT true;

-- One-time: treat existing subscriptions as opting in to uploads (prior default was misleading).
UPDATE "channel_follows" SET "notificationsEnabled" = true;
