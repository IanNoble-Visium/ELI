-- Migration: Update Gemini model to gemini-pro-vision
-- This is the stable vision model that works with v1 API
-- Run this manually: psql $DATABASE_URL -f drizzle/0003_update_gemini_model.sql

UPDATE "system_config" 
SET "value" = 'gemini-pro-vision', "updatedAt" = NOW()
WHERE "key" = 'gemini_model';
