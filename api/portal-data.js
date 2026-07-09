const SUPABASE_URL = 'https://zeumzuwbzagakwokzhpz.supabase.co';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No token' });

  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc) return res.status(500).json({ error: 'Server misconfiguration.' });
  const headers = { 'Content-Type': 'application/json', 'apikey': svc, 'Authorization': `Bearer ${svc}` };

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': svc, 'Authorization': `Bearer ${token}` }
    });
    if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userRes.json();

    const clientRes = await fetch(
      `${SUPABASE_URL}/rest/v1/clients?select=*&email=ilike.${encodeURIComponent(user.email)}`,
      { headers }
    );
    if (!clientRes.ok) return res.status(500).json({ error: 'Failed to load account.' });
    const [client] = await clientRes.json();
    if (!client) return res.status(404).json({ error: 'No client account found.' });

    const bookingsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?select=*&client_id=eq.${client.id}&order=appointment_date.asc`,
      { headers }
    );
    const bookings = bookingsRes.ok ? await bookingsRes.json() : [];

    let messages = [];
    const ids = bookings.map(b => b.id);
    if (ids.length) {
      const msgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/booking_messages?select=booking_id,role,content,created_at&booking_id=in.(${ids.join(',')})&order=created_at.asc`,
        { headers }
      );
      messages = msgRes.ok ? await msgRes.json() : [];
    }

    return res.status(200).json({ client, bookings, messages });
  } catch (err) {
    console.error('portal-data: unhandled error', err.message);
    return res.status(500).json({ error: 'Failed to load portal data.' });
  }
}
