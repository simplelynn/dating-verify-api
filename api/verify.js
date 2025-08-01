export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  
  // Return success for ANY request method
  return res.status(200).json({
    success: true,
    method: req.method,
    message: 'Request received!',
    timestamp: new Date().toISOString()
  });
}
