-- Migration 0009: app_settings key-value jadvali (classHourSlot — sinf soati kuni/vaqti)

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
