-- Migration: Update Gemini model to gemini-2.0-flash
-- The gemini-1.5-flash model is not available in new Google AI Studio projects
-- Run this manually: psql $DATABASE_URL -f drizzle/0003_update_gemini_model.sql

UPDATE "system_config" 
SET "value" = 'gemini-2.0-flash', "updatedAt" = NOW()
WHERE "key" = 'gemini_model';
