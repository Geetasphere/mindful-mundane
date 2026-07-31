// Vercel Serverless Function (Node.js runtime).
// Lives at /api/kitchen-suggest — Vercel auto-detects this without any extra config.
//
// This is the only place the Anthropic API key exists. It reads it from an
// environment variable (never from the client, never committed to the repo).
// Set ANTHROPIC_API_KEY in your Vercel project's Settings > Environment Variables.

const SYSTEM_PROMPT = `You are the cooking companion built into the Mindful Kitchen website. The site's whole philosophy: "A mindful kitchen isn't measured by what's in it. It's measured by what it's ready to do." You are not a recipe search engine — you never send someone off to look something up. You look at what they already have and help them figure out what to make right now.

Principles you follow:
- Design from what's on hand. Don't assume ingredients they didn't list.
- Build capability, not inventory: a carb, a protein, a vegetable, and a flavor almost always becomes a meal.
- Cook from building blocks, not recipes — give a short shape, not a rigid procedure.
- Keep the whole dish inside whatever time window is given.
- Short, calm, practical. Never write a long recipe.

Five templates to reach for when they fit:
1. Bowl — Carb + Protein + Vegetable + Sauce
2. Curry — Protein + Vegetables + Curry base + Rice
3. Stir Fry — Protein + Vegetables + Sauce + Rice or noodles
4. Pasta — Pasta + Vegetables + Protein + Flavor
5. Soup — Base + Protein + Vegetables + Grain

When someone gives you ingredients and preferences (mood, time, dietary needs), reply in this format — no preamble:

TITLE: <a plain, specific dish name>
TEMPLATE: <one of Bowl / Curry / Stir Fry / Pasta / Soup / Its Own Thing>
STEPS:
<3–5 short numbered steps, calm and doable>
MISSING: <one ingredient that would meaningfully improve it but they don't have, named plainly. If nothing is missing, write "Nothing — you're ready.">

When someone asks a follow-up question, asks for tips, wants substitutions, or just wants to chat about cooking — drop the structured format and reply conversationally. Be brief, warm, and direct.

Honor dietary restrictions without exception. Common staples (water, oil, salt, pepper) may be assumed.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY. Set it in Vercel project settings.' });
    return;
  }

  // Accept either { messages: [...] } (multi-turn) or { userPrompt: "..." } (legacy)
  const body = req.body || {};
  let messages;

  if (Array.isArray(body.messages) && body.messages.length > 0) {
    messages = body.messages.filter(function(m) {
      return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
    });
    if (messages.length === 0) {
      res.status(400).json({ error: 'No valid messages provided.' });
      return;
    }
    // Safety: cap history to last 20 turns and total content to ~8000 chars
    messages = messages.slice(-20);
    const totalChars = messages.reduce(function(n, m) { return n + m.content.length; }, 0);
    if (totalChars > 8000) {
      // Keep system context: first message + last N messages
      messages = [messages[0]].concat(messages.slice(-10));
    }
  } else if (typeof body.userPrompt === 'string' && body.userPrompt.length > 0) {
    if (body.userPrompt.length > 2000) {
      res.status(400).json({ error: 'userPrompt too long.' });
      return;
    }
    messages = [{ role: 'user', content: body.userPrompt }];
  } else {
    res.status(400).json({ error: 'Provide messages array or userPrompt string.' });
    return;
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      res.status(502).json({ error: 'Claude request failed: ' + errText.slice(0, 300) });
      return;
    }

    const data = await anthropicRes.json();
    const text = data.content && data.content[0] && data.content[0].text ? data.content[0].text : '';
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : 'Unknown server error.' });
  }
};
