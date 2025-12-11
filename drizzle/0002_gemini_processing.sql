-- Migration: Add Gemini AI processing columns to snapshots table
-- This migration adds columns for tracking Gemini image analysis processing
-- Run this manually: psql $DATABASE_URL -f drizzle/0002_gemini_processing.sql

-- Add Gemini processing columns to snapshots table
ALTER TABLE "snapshots" ADD COLUMN IF NOT EXISTS "gemini_processed" boolean DEFAULT false NOT NULL;
ALTER TABLE "snapshots" ADD COLUMN IF NOT EXISTS "gemini_processed_at" timestamp;
ALTER TABLE "snapshots" ADD COLUMN IF NOT EXISTS "gemini_model_used" varchar(100);
ALTER TABLE "snapshots" ADD COLUMN IF NOT EXISTS "gemini_error" text;

-- Create index for efficient querying of unprocessed images
CREATE INDEX IF NOT EXISTS "idx_snapshots_gemini_processed" ON "snapshots" ("gemini_processed");

-- Initialize system_config entries for Gemini settings (if they don't exist)
INSERT INTO "system_config" ("key", "value", "description", "updatedAt")
SELECT 'gemini_model', 'gemini-1.5-flash', 'Gemini model to use for image analysis', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "system_config" WHERE "key" = 'gemini_model');

INSERT INTO "system_config" ("key", "value", "description", "updatedAt")
SELECT 'gemini_batch_size', '100', 'Number of images to process per batch', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "system_config" WHERE "key" = 'gemini_batch_size');

INSERT INTO "system_config" ("key", "value", "description", "updatedAt")
SELECT 'gemini_enabled', 'false', 'Whether automatic Gemini processing is enabled', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "system_config" WHERE "key" = 'gemini_enabled');

INSERT INTO "system_config" ("key", "value", "description", "updatedAt")
SELECT 'gemini_schedule_minutes', '60', 'Minutes between processing runs', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "system_config" WHERE "key" = 'gemini_schedule_minutes');

INSERT INTO "system_config" ("key", "value", "description", "updatedAt")
SELECT 'gemini_daily_requests_count', '0', 'Daily API request counter', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "system_config" WHERE "key" = 'gemini_daily_requests_count');

INSERT INTO "system_config" ("key", "value", "description", "updatedAt")
SELECT 'gemini_daily_requests_date', '', 'Date of daily counter', NOW()
WHERE NOT EXISTS (SELECT 1 FROM "system_config" WHERE "key" = 'gemini_daily_requests_date');
