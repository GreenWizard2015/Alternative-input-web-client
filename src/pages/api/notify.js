// handle incoming POST request, and send notification to main server
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const data = req.body;
    // send message to main server
    await fetch(
      process.env.NOTIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return res.status(200).json({ success: true });
  }
  return res.status(405).json({ error: 'Method Not Allowed' });
}