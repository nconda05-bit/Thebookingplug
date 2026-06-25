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

  // Generate temp password
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let temp_password = '';
  for (let i = 0; i < 10; i++) {
    temp_password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Save to Supabase
  await fetch('https://zeumzuwbzagakwokzhpz.supabase.co/rest/v1/clients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ email, name, temp_password, stripe_customer_id, stripe_subscription_id, plan })
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
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#8a0a0a;color:#fff;border-radius:12px;padding:40px;"><h1>Welcome to The Booking Plug 🎉🔌</h1><p>Hey ${name}, you're all set!</p><div style="background:rgba(255,255,255,0.1);border-radius:8px;padding:24px;margin-bottom:24px;"><p>📧 <strong>Email:</strong> ${email}</p><p>🔑 <strong>Temp Password:</strong> ${temp_password}</p></div><a href="https://thebookingplug.net/portal.html" style="display:inline-block;background:#fff;color:#8a0a0a;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">Access Your Portal →</a><p style="opacity:0.75;font-size:14px;margin-top:24px;">Log in and change your password. Your booking link and QR code are waiting inside.</p></div>`
    })
  });

  res.status(200).json({ received: true });
}
