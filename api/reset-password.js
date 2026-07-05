const SUPABASE_URL = 'https://zeumzuwbzagakwokzhpz.supabase.co';
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required.' });

  const svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc) return res.status(500).json({ error: 'Server misconfiguration.' });

  try {
    return await resetPassword(email, svc, res);
  } catch (err) {
    console.error('reset-password: unhandled error', err.message);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
}

async function resetPassword(email, svc, res) {
  // Find the user by email
  const listRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`,
    { headers: { 'apikey': svc, 'Authorization': `Bearer ${svc}` } }
  );
  if (!listRes.ok) {
    console.error('reset-password: list users failed', listRes.status, await listRes.text());
    return res.status(500).json({ error: 'Failed to look up account.' });
  }
  const listData = await listRes.json();
  const users = listData.users || [];
  const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    // Don't leak whether the email exists — always return ok
    return res.status(200).json({ ok: true });
  }

  // Generate a readable temp password
  let temp = '';
  for (let i = 0; i < 10; i++) temp += CHARS.charAt(Math.floor(Math.random() * CHARS.length));

  // Set the temp password via admin API
  const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': svc,
      'Authorization': `Bearer ${svc}`
    },
    body: JSON.stringify({ password: temp })
  });

  if (!updateRes.ok) {
    console.error('reset-password: update failed', await updateRes.text());
    return res.status(500).json({ error: 'Failed to reset password.' });
  }

  // Send the temp password by email
  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#080808;color:#ffffff;border-radius:12px;padding:40px;">
  <div style="font-size:13px;font-weight:800;color:#1DDB7E;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:28px;">&#128299; THE BOOKING PLUG</div>
  <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.8px;margin:0 0 10px;color:#ffffff;">Your temporary password &#128273;</h1>
  <p style="color:#888888;margin:0 0 24px;font-size:14px;line-height:1.7;">Here is your temporary password to log back in:</p>
  <div style="background:#111111;border:1px solid #1DDB7E44;border-radius:10px;padding:20px 24px;margin-bottom:28px;text-align:center;">
    <span style="font-family:monospace;font-size:24px;font-weight:800;color:#1DDB7E;letter-spacing:3px;">${temp}</span>
  </div>
  <p style="color:#888888;font-size:14px;line-height:1.7;margin:0 0 28px;">
    Once you log in, scroll down to <strong style="color:#ffffff;">Change Password</strong> and set your own password using this temporary one as your current password.
  </p>
  <a href="https://thebookingplug.net/portal.html" style="display:inline-block;background:#1DDB7E;color:#000000;font-weight:800;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">Go to Portal &rarr;</a>
  <div style="border-top:1px solid #252525;margin-top:32px;padding-top:20px;">
    <p style="font-size:12px;color:#444444;margin:0;">The Booking Plug &middot; thebookingplug.net</p>
  </div>
</div>`;

  const mailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_KEY}`
    },
    body: JSON.stringify({
      from: 'The Booking Plug <noreply@thebookingplug.net>',
      to: email,
      subject: 'Your temporary password — The Booking Plug',
      html
    })
  });

  const mailData = await mailRes.json();
  if (!mailRes.ok) {
    console.error('reset-password: resend error', JSON.stringify(mailData));
    return res.status(500).json({ error: 'Failed to send email.' });
  }

  console.log('reset-password: sent to', email, mailData.id);
  return res.status(200).json({ ok: true });
}
