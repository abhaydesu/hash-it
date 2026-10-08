ALTER TABLE "UserSettings" ALTER COLUMN "dailyRecallCap" SET DEFAULT 5;

-- Move accounts still on the previous default; leave anything a user set themselves.
UPDATE "UserSettings" SET "dailyRecallCap" = 5 WHERE "dailyRecallCap" = 8;
