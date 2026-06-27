export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const event = req.body;
  if (event.type !== 'checkout.session.completed') return res.status(200).json({ received: true });

  const session = event.data.object;
  const email = session.customer_details?.email;
  const name = session.customer_details?.name;
  const stripe_customer_id = session.customer;
  const stripe_subscription_id = session.subscription;
  const plan = session.metadata?.plan || 'starter';

  // Generate a temp password for the Supabase auth user
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let temp_password = '';
  for(let i = 0; i < 12; i++) temp_password += chars.charAt(Math.floor(Math.random() * chars.length));

  // Create Supabase auth user via admin API (email_confirm:true skips confirmation email)
  // Uses service role key — must be set as SUPABASE_SERVICE_KEY env var in Vercel
  // 422 = user already exists; safe to continue in that case
  const authRes = await fetch('https://zeumzuwbzagakwokzhpz.supabase.co/auth/v1/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    },
    body: JSON.stringify({ email, password: temp_password, email_confirm: true })
  });
  console.log('auth user create status:', authRes.status);

  // Save to Supabase
  await fetch('https://zeumzuwbzagakwokzhpz.supabase.co/rest/v1/clients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ email, name, stripe_customer_id, stripe_subscription_id, plan })
  });

  // Send welcome email
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_KEY}`
    },
    body: JSON.stringify({
      from: 'The Booking Plug <noreply@thebookingplug.net>',
      to: email,
      subject: 'Welcome to The Booking Plug 🎉🔌',
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#080808;color:#fff;border-radius:12px;padding:40px;">
        <div style="font-size:13px;font-weight:800;color:#1DDB7E;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:28px;">🔌 THE BOOKING PLUG</div>
        <h1 style="font-size:26px;font-weight:800;letter-spacing:-0.8px;margin:0 0 10px;">Welcome, ${name}! 🎉</h1>
        <p style="color:#888;margin:0 0 32px;font-size:14px;line-height:1.7;">Your account is ready. Here are your login credentials:</p>
        <div style="background:#111;border:1px solid #252525;border-radius:10px;padding:24px;margin-bottom:28px;">
          <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#fff;">Your login details:</p>
          <p style="margin:0 0 8px;font-size:14px;color:#aaa;">Email: <strong style="color:#fff;">${email}</strong></p>
          <p style="margin:0;font-size:14px;color:#aaa;">Temporary password: <strong style="color:#1DDB7E;font-family:monospace;font-size:16px;">${temp_password}</strong></p>
        </div>
        <div style="background:#111;border:1px solid #252525;border-radius:10px;padding:24px;margin-bottom:28px;">
          <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#fff;">How to sign in:</p>
          <ol style="margin:0;padding-left:20px;color:#bbb;font-size:14px;line-height:2.2;">
            <li>Go to <strong style="color:#1DDB7E;">thebookingplug.net/portal.html</strong></li>
            <li>Enter your email and the temporary password above</li>
            <li>Once you're in, scroll down to <strong style="color:#fff;">Change Password</strong> to set your own password</li>
          </ol>
        </div>
        <a href="https://thebookingplug.net/portal.html" style="display:inline-block;background:#1DDB7E;color:#000;font-weight:800;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">Go to My Portal →</a>
        <p style="color:#555;font-size:13px;margin-top:28px;line-height:1.6;">If you ever forget your password, click "Forgot password?" on the portal login page and we'll send you a reset link.</p>
        <div style="border-top:1px solid #252525;margin-top:32px;padding-top:20px;">
          <p style="font-size:12px;color:#444;margin:0;">The Booking Plug &middot; thebookingplug.net</p>
        </div>
      </div>`
    })
  });

  res.status(200).json({ received: true });
}
