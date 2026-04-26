-- Deduplicate vendors (case-insensitive) before creating the unique index.
-- Keeps the earliest-created record for each name; reassigns any bills that
-- reference a removed duplicate to the canonical vendor first.

WITH ranked AS (
  SELECT id,
         lower(name) AS lower_name,
         ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY "createdAt" ASC) AS rn
  FROM "Vendor"
),
duplicates AS (
  SELECT r.id AS dup_id, c.id AS canonical_id
  FROM ranked r
  JOIN ranked c ON r.lower_name = c.lower_name AND c.rn = 1
  WHERE r.rn > 1
)
UPDATE "Bill"
SET "vendorId" = d.canonical_id
FROM duplicates d
WHERE "Bill"."vendorId" = d.dup_id;

DELETE FROM "Vendor"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY lower(name) ORDER BY "createdAt" ASC) AS rn
    FROM "Vendor"
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_name_lower_unique ON "Vendor" (lower(name));
