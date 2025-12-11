/**
 * API endpoint to list available Gemini models for the configured API key
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    // Try v1 API first
    const v1Response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );
    const v1Data = await v1Response.json();

    // Try v1beta API
    const v1betaResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const v1betaData = await v1betaResponse.json();

    return res.status(200).json({
      v1: {
        status: v1Response.status,
        models: v1Data.models?.map((m: any) => ({
          name: m.name,
          displayName: m.displayName,
          supportedGenerationMethods: m.supportedGenerationMethods,
        })) || v1Data,
      },
      v1beta: {
        status: v1betaResponse.status,
        models: v1betaData.models?.map((m: any) => ({
          name: m.name,
          displayName: m.displayName,
          supportedGenerationMethods: m.supportedGenerationMethods,
        })) || v1betaData,
      },
    });
  } catch (error) {
    console.error('[Gemini Models] Error:', error);
    return res.status(500).json({ error: String(error) });
  }
}
