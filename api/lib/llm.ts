export type InvokeParams = {
  messages: any[];
  tools?: any[];
  toolChoice?: any;
  tool_choice?: any;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: any;
  output_schema?: any;
  responseFormat?: any;
  response_format?: any;
};

export async function invokeLLM(params: InvokeParams): Promise<any> {
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!apiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  const apiUrlBase = (process.env.BUILT_IN_FORGE_API_URL || "https://forge.manus.im").replace(/\/$/, "");
  const url = `${apiUrlBase}/v1/chat/completions`;

  const payload: any = {
    model: "gemini-2.5-flash",
    messages: params.messages,
  };

  if (params.tools) payload.tools = params.tools;
  if (params.tool_choice || params.toolChoice) payload.tool_choice = params.tool_choice || params.toolChoice;

  payload.max_tokens = params.max_tokens || params.maxTokens || 32768;
  payload.thinking = { budget_tokens: 128 };

  if (params.response_format || params.responseFormat) payload.response_format = params.response_format || params.responseFormat;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  return await response.json();
}
