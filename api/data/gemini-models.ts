/**
 * API endpoint to list available Z.ai vision models
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GEMINI_MODELS } from '../lib/gemini.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ZAI_API_KEY not configured' });
  }

  try {
    // Return the hardcoded Z.ai model list (Z.ai doesn't expose a model listing API)
    const models = Object.entries(GEMINI_MODELS).map(([id, info]) => ({
      name: `models/${id}`,
      displayName: info.name,
      description: info.description,
      rpm: info.rpm,
      rpd: info.rpd,
    }));

    return res.status(200).json({
      provider: 'z.ai',
      models,
      apiKeyConfigured: true,
    });
  } catch (error) {
    console.error('[Z.ai Models] Error:', error);
    return res.status(500).json({ error: String(error) });
  }
}
