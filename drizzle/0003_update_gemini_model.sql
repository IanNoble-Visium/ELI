-- Migration: Update Gemini model to gemini-2.0-flash
-- This model is verified available via /api/data/gemini-models on v1 API
-- Run this manually: psql $DATABASE_URL -f drizzle/0003_update_gemini_model.sql

UPDATE "system_config" 
SET "value" = 'gemini-2.0-flash', "updatedAt" = NOW()
WHERE "key" = 'gemini_model';
