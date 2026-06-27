const SUPABASE_URL = 'https://zeumzuwbzagakwokzhpz.supabase.co';
const ADMIN_EMAILS = ['cashbullysllc@gmail.com', 'nconda05@gmail.com'];

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No token' });

  // Verify the token and get the user
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${token}`
    }
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Invalid token' });
  const user = await userRes.json();

  if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const svc = process.env.SUPABASE_SERVICE_KEY;
  const headers = {
    'apikey': svc,
    'Authorization': `Bearer ${svc}`,
    'Content-Type': 'application/json'
  };

  const [clientsRes, leadsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/clients?select=*&order=created_at.desc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc`, { headers })
  ]);

  const [clients, leads] = await Promise.all([clientsRes.json(), leadsRes.json()]);

  return res.status(200).json({ clients, leads });
}
