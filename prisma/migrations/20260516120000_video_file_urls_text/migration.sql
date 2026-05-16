-- Довгі прямі URL (R2 signed тощо) не вміщались у VARCHAR(255) — плеєр отримував зламане посилання.
ALTER TABLE "videos" ALTER COLUMN "videoFile" SET DATA TYPE TEXT;
ALTER TABLE "videos" ALTER COLUMN "thumbnailFile" SET DATA TYPE TEXT;
