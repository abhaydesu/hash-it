-- User-defined columns. Additive and nullable: no existing rows change.
ALTER TABLE "UserSettings" ADD COLUMN "customFields" JSONB;
ALTER TABLE "Entry" ADD COLUMN "customValues" JSONB;
