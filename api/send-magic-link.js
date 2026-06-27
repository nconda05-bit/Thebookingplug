const SUPABASE_URL = 'https://zeumzuwbzagakwokzhpz.supabase.co';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, type = 'magiclink' } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });

  if (!process.env.SUPABASE_SERVICE_KEY) {
    console.error('send-magic-link: SUPABASE_SERVICE_KEY not set');
    return res.status(500).json({ error: 'server misconfiguration' });
  }
  if (!process.env.RESEND_KEY) {
    console.error('send-magic-link: RESEND_KEY not set');
    return res.status(500).json({ error: 'server misconfiguration' });
  }

  // Generate the link via Supabase Admin API (works on all tiers)
  const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    },
    body: JSON.stringify({
      type,
      email,
      redirect_to: 'https://thebookingplug.net/portal.html'
    })
  });

  const genData = await genRes.json();
  console.log('generate_link response:', genRes.status, JSON.stringify(genData));

  // action_link may be at top level or nested in properties
  const actionLink = genData.action_link || genData.properties?.action_link;
  if (!genRes.ok || !actionLink) {
    console.error('send-magic-link: no action_link in response', JSON.stringify(genData));
    return res.status(500).json({ error: 'failed to generate link' });
  }

  let subject, html;

  if (type === 'recovery') {
    subject = 'Reset your password — The Booking Plug';
    html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#080808;color:#ffffff;border-radius:12px;padding:40px;">
  <div style="font-size:13px;font-weight:800;color:#1DDB7E;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:28px;">&#128299; THE BOOKING PLUG</div>
  <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.8px;margin:0 0 10px;color:#ffffff;">Reset your password &#128273;</h1>
  <p style="color:#888888;margin:0 0 32px;font-size:14px;line-height:1.7;">We received a request to reset the password for your Booking Plug account. Click the button below to choose a new one.</p>
  <a href="${actionLink}" style="display:inline-block;background:#1DDB7E;color:#000000;font-weight:800;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">Reset My Password &rarr;</a>
  <p style="color:#555555;font-size:13px;margin-top:28px;line-height:1.6;">If you didn't request this, you can safely ignore this email. This link expires in 1 hour.</p>
  <div style="border-top:1px solid #252525;margin-top:32px;padding-top:20px;">
    <p style="font-size:12px;color:#444444;margin:0;">The Booking Plug &middot; thebookingplug.net</p>
  </div>
</div>`;
  } else {
    subject = 'Your sign-in link — The Booking Plug';
    html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#080808;color:#ffffff;border-radius:12px;padding:40px;">
  <div style="font-size:13px;font-weight:800;color:#1DDB7E;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:28px;">&#128299; THE BOOKING PLUG</div>
  <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.8px;margin:0 0 10px;color:#ffffff;">Here's your sign-in link &#128279;</h1>
  <p style="color:#888888;margin:0 0 32px;font-size:14px;line-height:1.7;">Click the button below to sign in to your Booking Plug portal. This link expires in 1 hour and can only be used once.</p>
  <a href="${actionLink}" style="display:inline-block;background:#1DDB7E;color:#000000;font-weight:800;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">Sign In to My Portal &rarr;</a>
  <p style="color:#555555;font-size:13px;margin-top:28px;line-height:1.6;">If you didn't request this link, you can safely ignore this email.</p>
  <div style="border-top:1px solid #252525;margin-top:32px;padding-top:20px;">
    <p style="font-size:12px;color:#444444;margin:0;">The Booking Plug &middot; thebookingplug.net</p>
  </div>
</div>`;
  }

  const mailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_KEY}`
    },
    body: JSON.stringify({
      from: 'The Booking Plug <noreply@thebookingplug.net>',
      to: email,
      subject,
      html
    })
  });

  const mailData = await mailRes.json();
  if (!mailRes.ok) {
    console.error('send-magic-link Resend error:', JSON.stringify(mailData));
    return res.status(500).json({ error: 'failed to send email' });
  }

  console.log('send-magic-link sent:', type, email, mailData.id);
  return res.status(200).json({ ok: true });
}
