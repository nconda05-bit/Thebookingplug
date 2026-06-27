export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  
  const { businessName, name, email, phone, message } = req.body;
  console.log("notify-lead hit:", { businessName, name, email });
  
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_KEY}`
      },
      body: JSON.stringify({
        from: "The Booking Plug <noreply@thebookingplug.net>",
        to: "cashbullysllc@gmail.com",
        subject: `New Lead: ${businessName}`,
        html: `<h2>New Lead</h2><p><b>Business:</b> ${businessName}</p><p><b>Name:</b> ${name}</p><p><b>Email:</b> ${email}</p><p><b>Phone:</b> ${phone}</p><p><b>Message:</b> ${message}</p>`
      })
    });
    const data = await r.json();
    console.log("Resend response:", JSON.stringify(data));
    res.status(200).json({ success: true });
  } catch(e) {
    console.error("notify-lead error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
