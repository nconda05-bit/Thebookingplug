const SUPABASE_URL = 'https://zeumzuwbzagakwokzhpz.supabase.co';
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export default async function handler(req, res) {
  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc) return res.status(500).json({ error: 'Server misconfiguration.' });
  const headers = { 'Content-Type': 'application/json', 'apikey': svc, 'Authorization': `Bearer ${svc}` };

  try {
    if (req.method === 'GET') return await getBooking(req, res, headers);
    if (req.method === 'POST') return await postAction(req, res, headers);
    return res.status(405).end();
  } catch (err) {
    console.error('book: unhandled error', err.message);
    return res.status(500).json({ error: 'Request failed.' });
  }
}

function genToken(len = 24) {
  let t = '';
  for (let i = 0; i < len; i++) t += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  return t;
}

// ── GET /api/book?token=... — booking details + client info + chat history ──
async function getBooking(req, res, headers) {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: 'token required' });

  const bookingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?select=*&confirmation_token=eq.${encodeURIComponent(token)}`,
    { headers }
  );
  if (!bookingRes.ok) return res.status(500).json({ error: 'Lookup failed.' });
  const [booking] = await bookingRes.json();
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });

  const clientRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=owner_name,business_name,service,business_type&id=eq.${booking.client_id}`,
    { headers }
  );
  const clients = clientRes.ok ? await clientRes.json() : [];
  const client = clients[0] || {};

  const msgRes = await fetch(
    `${SUPABASE_URL}/rest/v1/booking_messages?select=role,content,created_at&booking_id=eq.${booking.id}&order=created_at.asc`,
    { headers }
  );
  const messages = msgRes.ok ? await msgRes.json() : [];

  return res.status(200).json({ booking, client, messages });
}

// ── POST /api/book — action-dispatched writes ──
async function postAction(req, res, headers) {
  const body = req.body || {};
  const action = body.action || 'create';

  if (action === 'create') return await createBooking(body, res, headers);
  if (action === 'update') return await updateBooking(body, res, headers);
  if (action === 'cancel') return await cancelBooking(body, res, headers);
  if (action === 'message') return await saveMessage(body, res, headers);
  return res.status(400).json({ error: 'Unknown action.' });
}

async function createBooking(body, res, headers) {
  const { client_id, customer_name, customer_phone, customer_email, appointment_date, appointment_time } = body;
  if (!client_id || !customer_name || !appointment_date || !appointment_time) {
    return res.status(400).json({ error: 'Missing required booking fields.' });
  }
  const confirmation_token = genToken();

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      client_id, customer_name, customer_phone, customer_email,
      appointment_date, appointment_time, status: 'confirmed', confirmation_token
    })
  });
  if (!insertRes.ok) {
    console.error('book: insert failed', await insertRes.text());
    return res.status(500).json({ error: 'Failed to save booking.' });
  }

  const clientRes = await fetch(
    `${SUPABASE_URL}/rest/v1/clients?select=owner_name,business_name&id=eq.${client_id}`,
    { headers }
  );
  const clients = clientRes.ok ? await clientRes.json() : [];
  const businessName = clients[0]?.owner_name || clients[0]?.business_name || 'your barber';

  if (customer_email && process.env.RESEND_KEY) {
    const chatLink = `https://thebookingplug.net/chat.html?token=${confirmation_token}`;
    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#080808;color:#ffffff;border-radius:12px;padding:40px;">
  <div style="font-size:13px;font-weight:800;color:#1DDB7E;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:28px;">&#128299; THE BOOKING PLUG</div>
  <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.8px;margin:0 0 10px;color:#ffffff;">You're booked with ${businessName}! &#9989;</h1>
  <p style="color:#888888;margin:0 0 24px;font-size:14px;line-height:1.7;">${appointment_date} at ${appointment_time}</p>
  <a href="${chatLink}" style="display:inline-block;background:#1DDB7E;color:#000000;font-weight:800;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">View or Reschedule &rarr;</a>
  <p style="color:#555555;font-size:13px;margin-top:28px;line-height:1.6;">Need to change the time or have a question? Tap the link above to chat with Alex, your booking assistant.</p>
  <div style="border-top:1px solid #252525;margin-top:32px;padding-top:20px;">
    <p style="font-size:12px;color:#444444;margin:0;">The Booking Plug &middot; thebookingplug.net</p>
  </div>
</div>`;
    const mailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_KEY}` },
      body: JSON.stringify({
        from: 'The Booking Plug <noreply@thebookingplug.net>',
        to: customer_email,
        subject: `Booking confirmed with ${businessName} — The Booking Plug`,
        html
      })
    });
    if (!mailRes.ok) console.error('book: confirmation email failed', await mailRes.text());
  }

  return res.status(200).json({ ok: true, token: confirmation_token });
}

async function updateBooking(body, res, headers) {
  const { token, appointment_date, appointment_time } = body;
  if (!token || !appointment_date || !appointment_time) {
    return res.status(400).json({ error: 'Missing fields.' });
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?confirmation_token=eq.${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ appointment_date, appointment_time })
  });
  if (!r.ok) {
    console.error('book: update failed', await r.text());
    return res.status(500).json({ error: 'Failed to update booking.' });
  }
  return res.status(200).json({ ok: true });
}

async function cancelBooking(body, res, headers) {
  const { token } = body;
  if (!token) return res.status(400).json({ error: 'token required' });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?confirmation_token=eq.${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'cancelled' })
  });
  if (!r.ok) {
    console.error('book: cancel failed', await r.text());
    return res.status(500).json({ error: 'Failed to cancel booking.' });
  }
  return res.status(200).json({ ok: true });
}

async function saveMessage(body, res, headers) {
  const { token, role, content } = body;
  if (!token || !role || !content) return res.status(400).json({ error: 'Missing fields.' });
  if (role !== 'user' && role !== 'assistant') return res.status(400).json({ error: 'Invalid role.' });

  const bookingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?select=id&confirmation_token=eq.${encodeURIComponent(token)}`,
    { headers }
  );
  const bookings = bookingRes.ok ? await bookingRes.json() : [];
  const booking = bookings[0];
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/booking_messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ booking_id: booking.id, role, content })
  });
  if (!r.ok) {
    console.error('book: save message failed', await r.text());
    return res.status(500).json({ error: 'Failed to save message.' });
  }
  return res.status(200).json({ ok: true });
}
