export async function handler(event) {
  try {
    const { message } = JSON.parse(event.body);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: message,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    // Show the real Gemini error if something went wrong
    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return {
        statusCode: response.status,
        body: JSON.stringify({
          reply: JSON.stringify(data),
        }),
      };
    }

    const reply = data.candidates[0].content.parts[0].text;

    return {
      statusCode: 200,
      body: JSON.stringify({ reply }),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        reply: error.message,
      }),
    };
  }
}
