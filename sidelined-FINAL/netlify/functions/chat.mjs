// Netlify Function: secure proxy to the Anthropic API.
// The API key lives ONLY as a Netlify environment variable (ANTHROPIC_API_KEY),
// never in any file the browser can see.

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY. Add it in Netlify → Site configuration → Environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Diagnostic logging — safe, doesn't expose the full key.
  // Visible in Netlify → your site → Functions → chat → real-time/recent logs.
  console.log("DIAGNOSTIC: key length =", apiKey.length);
  console.log("DIAGNOSTIC: key starts with =", JSON.stringify(apiKey.slice(0, 12)));
  console.log("DIAGNOSTIC: key ends with =", JSON.stringify(apiKey.slice(-6)));
  console.log("DIAGNOSTIC: has whitespace/newline =", /\s/.test(apiKey));

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Only forward the fields we expect — never let the browser dictate the model or add extras.
  const payload = {
    model: "claude-sonnet-5",
    max_tokens: 1000,
    system: body.system,
    messages: body.messages
  };

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(payload)
    });

    const data = await upstream.text();
    return new Response(data, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Upstream request failed", detail: String(err) }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
};
