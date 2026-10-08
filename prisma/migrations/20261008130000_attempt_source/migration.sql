CREATE TYPE "AttemptSource" AS ENUM ('IMPORT', 'LOG', 'REVIEW');

ALTER TABLE "Attempt" ADD COLUMN "source" "AttemptSource" NOT NULL DEFAULT 'LOG';

-- Queue reviews set a lane; every other existing attempt was a log.
UPDATE "Attempt" SET "source" = 'REVIEW' WHERE "lane" IS NOT NULL;
