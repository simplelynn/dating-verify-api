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

  // Debug: Log what we received
  console.log('Request body:', req.body);
  console.log('Image URL:', req.body?.image_url);

  const { image_url } = req.body || {};
  
  if (!image_url) {
    return res.status(400).json({ 
      error: 'image_url is required',
      received_body: req.body,
      message: 'Please provide an image_url in the request body'
    });
  }

  try {
    // First, just test if we can download the image
    console.log('Testing image download from:', image_url);
    
    const imageResponse = await fetch(image_url);
    
    if (!imageResponse.ok) {
      return res.status(400).json({ 
        error: 'Failed to download image',
        status: imageResponse.status,
        image_url: image_url
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Image URL is valid and accessible',
      image_url: image_url,
      next_step: 'Ready to integrate with FaceCheck'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message,
      image_url: image_url,
      message: 'Failed to process request'
    });
  }
}
