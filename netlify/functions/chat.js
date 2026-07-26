const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

const errorResponse = (statusCode, code, message, providerStatus) =>
  json(statusCode, {
    error: {
      code,
      message,
      ...(providerStatus ? { providerStatus } : {})
    }
  });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.');
  }

  if (!process.env.GEMINI_API_KEY) {
    return errorResponse(500, 'GEMINI_NOT_CONFIGURED', 'The chat service is not configured.');
  }

  let message;
  try {
    ({ message } = JSON.parse(event.body || '{}'));
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'The chat request must contain valid JSON.');
  }

  if (typeof message !== 'string' || !message.trim()) {
    return errorResponse(400, 'INVALID_MESSAGE', 'Please enter a message before sending.');
  }

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: 'You are Mira, the helpful assistant for Manglik Meets. Be warm, respectful, concise, and helpful with profiles, privacy, and respectful conversations.'
          }]
        },
        contents: [{
          role: 'user',
          parts: [{ text: message.trim().slice(0, 4000) }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const providerMessage = payload?.error?.message || `Gemini returned HTTP ${response.status}.`;
      return errorResponse(
        502,
        'GEMINI_API_ERROR',
        `Gemini API error (${response.status}): ${providerMessage}`,
        response.status
      );
    }

    const reply = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join('\n')
      ?.trim();

    if (!reply) {
      return errorResponse(502, 'GEMINI_EMPTY_RESPONSE', 'Gemini did not return a text response.');
    }

    return json(200, { reply });
  } catch {
    return errorResponse(502, 'GEMINI_NETWORK_ERROR', 'Unable to reach the Gemini API. Please try again shortly.');
  }
};
