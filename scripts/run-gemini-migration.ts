/**
 * Run Gemini migration directly against the database
 * Usage: npx tsx scripts/run-gemini-migration.ts
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not configured");
    process.exit(1);
  }

  const sql = neon(dbUrl);
  console.log("Connected to database");

  try {
    // Add Gemini processing columns to snapshots table
    console.log("Adding gemini_processed column...");
    await sql`ALTER TABLE "snapshots" ADD COLUMN IF NOT EXISTS "gemini_processed" boolean DEFAULT false NOT NULL`;
    
    console.log("Adding gemini_processed_at column...");
    await sql`ALTER TABLE "snapshots" ADD COLUMN IF NOT EXISTS "gemini_processed_at" timestamp`;
    
    console.log("Adding gemini_model_used column...");
    await sql`ALTER TABLE "snapshots" ADD COLUMN IF NOT EXISTS "gemini_model_used" varchar(100)`;
    
    console.log("Adding gemini_error column...");
    await sql`ALTER TABLE "snapshots" ADD COLUMN IF NOT EXISTS "gemini_error" text`;

    // Create index
    console.log("Creating index...");
    await sql`CREATE INDEX IF NOT EXISTS "idx_snapshots_gemini_processed" ON "snapshots" ("gemini_processed")`;

    // Insert system config entries
    console.log("Inserting system config entries...");
    
    const configs = [
      { key: 'gemini_model', value: 'gemini-1.5-flash', description: 'Gemini model to use for image analysis' },
      { key: 'gemini_batch_size', value: '100', description: 'Number of images to process per batch' },
      { key: 'gemini_enabled', value: 'false', description: 'Whether automatic Gemini processing is enabled' },
      { key: 'gemini_schedule_minutes', value: '60', description: 'Minutes between processing runs' },
      { key: 'gemini_daily_requests_count', value: '0', description: 'Daily API request counter' },
      { key: 'gemini_daily_requests_date', value: '', description: 'Date of daily counter' },
    ];

    for (const config of configs) {
      const existing = await sql`SELECT 1 FROM "system_config" WHERE "key" = ${config.key}`;
      if (existing.length === 0) {
        await sql`INSERT INTO "system_config" ("key", "value", "description", "updatedAt") VALUES (${config.key}, ${config.value}, ${config.description}, NOW())`;
        console.log(`  Inserted config: ${config.key}`);
      } else {
        console.log(`  Config already exists: ${config.key}`);
      }
    }

    console.log("\n✅ Migration completed successfully!");
    
    // Verify
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'snapshots' AND column_name LIKE 'gemini%'
    `;
    console.log("\nGemini columns in snapshots table:");
    columns.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`));

  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
