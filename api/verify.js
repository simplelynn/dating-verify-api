export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Return exactly what we receive
  return res.status(200).json({
    success: true,
    method: req.method,
    headers: req.headers,
    body: req.body,
    body_type: typeof req.body,
    body_stringified: JSON.stringify(req.body),
    raw_body: req.body
  });
}
