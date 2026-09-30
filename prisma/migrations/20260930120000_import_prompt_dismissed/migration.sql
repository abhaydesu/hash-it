-- AlterTable
ALTER TABLE "User" ADD COLUMN "importPromptDismissedAt" TIMESTAMP(3);

-- The import banner is for new sign-ups; don't show it to accounts that already exist.
UPDATE "User" SET "importPromptDismissedAt" = NOW();
