-- Add moderator restriction audit fields on reports
ALTER TABLE "reports" ADD COLUMN "moderator_restriction_reason" "ReportReason",
ADD COLUMN "moderator_note" TEXT;
