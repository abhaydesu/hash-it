-- Solve-time baselines relaxed from 15/30/45 to 20/40/60 minutes so that a
-- realistic cold solve is not treated as slow.
ALTER TABLE "UserSettings" ALTER COLUMN "easyBaseline" SET DEFAULT 20;
ALTER TABLE "UserSettings" ALTER COLUMN "mediumBaseline" SET DEFAULT 40;
ALTER TABLE "UserSettings" ALTER COLUMN "hardBaseline" SET DEFAULT 60;

-- Lift rows still sitting on the previous defaults. Rows whose baselines were
-- deliberately customised do not match this predicate and are left untouched.
UPDATE "UserSettings"
SET "easyBaseline" = 20, "mediumBaseline" = 40, "hardBaseline" = 60
WHERE "easyBaseline" = 15 AND "mediumBaseline" = 30 AND "hardBaseline" = 45;
