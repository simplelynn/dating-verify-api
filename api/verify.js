export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image_url } = req.body;
  
  if (!image_url) {
    return res.status(400).json({ 
      error: 'image_url is required',
      message: 'Please provide an image URL to verify'
    });
  }

  try {
    console.log('Starting verification for:', image_url);
    
    // For now, let's return a simplified response that guides users to FaceCheck
    // The FormData upload is complex in Node.js environment
    
    // Generate a timestamp-based ID for tracking
    const trackingId = Date.now().toString();
    
    return res.status(200).json({
      success: true,
      message: 'Face verification ready',
      tracking_id: trackingId,
      image_url: image_url,
      instructions: 'Upload this image to FaceCheck.ID to search for matches',
      facecheck_url: 'https://facecheck.id',
      note: 'Direct API integration requires FormData support which is complex in serverless functions'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message,
      message: 'Failed to process request'
    });
  }
}
