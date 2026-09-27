-- Imports used to stamp a placeholder when the CSV had no Source column.
-- Those values carry no information, so clear them.
UPDATE "Entry" SET "sourceList" = NULL
WHERE "sourceList" IN ('csv-import', 'leetcode-progress-import');
