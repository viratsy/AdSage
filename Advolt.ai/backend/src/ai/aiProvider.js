/**
 * Advolt.ai AI Provider Abstraction
 * Default: Google Gemini 1.5 Flash (cost-effective, fast)
 * Fallback: OpenAI GPT-4o
 * User own key: passed directly
 */

const callGemini = async (prompt, apiKey) => {
  const key = apiKey || process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini error: ${response.status} — ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
};

const callGroq = async (prompt, apiKey) => {
  const key = apiKey || process.env.GROQ_API_KEY;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are an expert ad analyst. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Groq error: ${response.status} — ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

const callOpenAI = async (prompt, apiKey) => {
  const key = apiKey || process.env.OPENAI_API_KEY;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content;
};

/**
 * Call AI with automatic provider selection.
 * @param {string} prompt
 * @param {object} options
 * @param {string} [options.provider] - 'gemini' | 'openai' (default: gemini)
 * @param {string} [options.ownApiKey] - user's own decrypted API key
 */
exports.callAi = async (prompt, options = {}) => {
  const provider = options.provider || process.env.AI_PROVIDER || 'groq';

  if (provider === 'gemini') return callGemini(prompt, options.ownApiKey);
  if (provider === 'openai') return callOpenAI(prompt, options.ownApiKey);
  return callGroq(prompt, options.ownApiKey);
};
