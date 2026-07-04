export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server misconfiguration.' });

  const { system, messages, model, max_tokens } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages required.' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5',
        max_tokens: max_tokens || 150,
        system,
        messages
      })
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('chat: anthropic error', JSON.stringify(data));
      return res.status(502).json({ error: 'AI request failed.' });
    }
    return res.status(200).json(data);
  } catch (err) {
    console.error('chat: fetch error', err.message);
    return res.status(500).json({ error: 'AI request failed.' });
  }
}
