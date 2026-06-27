const SUPABASE_URL = 'https://zeumzuwbzagakwokzhpz.supabase.co';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Log full payload so we can see exactly what Supabase sends
  console.log('auth-email hook payload:', JSON.stringify(req.body));

  const { user, email_data } = req.body || {};
  const email = user?.email;

  // Supabase sends token_hash; older versions may send token — handle both
  const email_action_type = email_data?.email_action_type;
  const token_hash = email_data?.token_hash || email_data?.token;
  const redirect_to = email_data?.redirect_to;

  if (!email || !email_action_type || !token_hash) {
    console.log('auth-email: missing fields', { email, email_action_type, token_hash });
    return res.status(200).json({});
  }

  if (!process.env.RESEND_KEY) {
    console.error('auth-email: RESEND_KEY not set');
    return res.status(200).json({});
  }

  const confirmURL =
    `${SUPABASE_URL}/auth/v1/verify` +
    `?token=${encodeURIComponent(token_hash)}` +
    `&type=${encodeURIComponent(email_action_type)}` +
    `&redirect_to=${encodeURIComponent(redirect_to || 'https://thebookingplug.net/portal.html')}`;

  let subject, html;

  if (email_action_type === 'recovery') {
    subject = 'Reset your password — The Booking Plug';
    html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#080808;color:#ffffff;border-radius:12px;padding:40px;">
  <div style="font-size:13px;font-weight:800;color:#1DDB7E;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:28px;">&#128299; THE BOOKING PLUG</div>
  <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.8px;margin:0 0 10px;color:#ffffff;">Reset your password &#128273;</h1>
  <p style="color:#888888;margin:0 0 32px;font-size:14px;line-height:1.7;">We received a request to reset the password for your Booking Plug account. Click the button below to choose a new one.</p>
  <a href="${confirmURL}" style="display:inline-block;background:#1DDB7E;color:#000000;font-weight:800;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">Reset My Password &rarr;</a>
  <p style="color:#555555;font-size:13px;margin-top:28px;line-height:1.6;">If you didn't request this, you can safely ignore this email. This link expires in 1 hour.</p>
  <div style="border-top:1px solid #252525;margin-top:32px;padding-top:20px;">
    <p style="font-size:12px;color:#444444;margin:0;">The Booking Plug &middot; thebookingplug.net</p>
  </div>
</div>`;
  } else if (email_action_type === 'magiclink') {
    subject = 'Your sign-in link — The Booking Plug';
    html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#080808;color:#ffffff;border-radius:12px;padding:40px;">
  <div style="font-size:13px;font-weight:800;color:#1DDB7E;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:28px;">&#128299; THE BOOKING PLUG</div>
  <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.8px;margin:0 0 10px;color:#ffffff;">Here's your sign-in link &#128279;</h1>
  <p style="color:#888888;margin:0 0 32px;font-size:14px;line-height:1.7;">Click the button below to sign in to your Booking Plug portal. This link expires in 1 hour and can only be used once.</p>
  <a href="${confirmURL}" style="display:inline-block;background:#1DDB7E;color:#000000;font-weight:800;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">Sign In to My Portal &rarr;</a>
  <p style="color:#555555;font-size:13px;margin-top:28px;line-height:1.6;">If you didn't request this link, you can safely ignore this email.</p>
  <div style="border-top:1px solid #252525;margin-top:32px;padding-top:20px;">
    <p style="font-size:12px;color:#444444;margin:0;">The Booking Plug &middot; thebookingplug.net</p>
  </div>
</div>`;
  } else {
    console.log('auth-email: unhandled type', email_action_type);
    return res.status(200).json({});
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
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

    const data = await r.json();
    if (!r.ok) {
      console.error('auth-email Resend error:', JSON.stringify(data));
    } else {
      console.log('auth-email sent:', email_action_type, email, data.id);
    }
  } catch (err) {
    console.error('auth-email fetch error:', err.message);
  }

  return res.status(200).json({});
}
