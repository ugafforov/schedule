-- Faza 5: "vakant" o'qituvchini ism-matn heuristikasi (lastName ILIKE '%vakant%')
-- o'rniga aniq flag bilan belgilash. Mavjud vakant yozuvlar backfill qilinadi.

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_vacant BOOLEAN NOT NULL DEFAULT false;

UPDATE teachers SET is_vacant = true WHERE lower(last_name) LIKE '%vakant%';
