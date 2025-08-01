const FormData = require('form-data');
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
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
  console.log('Request body:', JSON.stringify(req.body));
  
  // Try multiple parameter names in case Bubble sends differently
  const photo_url = req.body?.photo_url || req.body?.image_url || req.body?.url;
  
  console.log('Extracted URL:', photo_url);
  console.log('Type:', typeof photo_url);

  // Check if we got a valid URL
  if (!photo_url || photo_url === 'null' || photo_url === null) {
    return res.status(400).json({ 
      error: 'No URL provided',
      message: 'Please provide a photo_url in the request',
      received_body: req.body,
      tip: 'Make sure Bubble is sending the parameter correctly'
    });
  }

  // Validate it's a real URL
  try {
    new URL(photo_url);
  } catch (urlError) {
    return res.status(400).json({
      error: 'Invalid URL format',
      message: 'The photo_url must be a valid URL',
      received_url: photo_url
    });
  }

  // Your FaceCheck token
  const authToken = 'wV1cRvip6IZSFLf5gS/3RZbSTc+Vq1DvSxuSifR0D7HokiBcLi0WUpRRg91Tad6bTaX4wq7I8Ak=';

  try {
    console.log('Downloading image from:', photo_url);
    
    // Download the image
    const imageResponse = await fetch(photo_url);
    
    if (!imageResponse.ok) {
      return res.status(400).json({
        error: 'Failed to download image',
        status: imageResponse.status,
        url: photo_url
      });
    }
    
    // Get image as buffer
    const imageBuffer = await imageResponse.buffer();
    console.log('Image downloaded, size:', imageBuffer.length);
    
    // Create form data
    const formData = new FormData();
    formData.append('images', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg'
    });
    
    console.log('Uploading to FaceCheck.ID...');
    
    // Upload to FaceCheck
    const uploadResponse = await fetch('https://facecheck.id/api/upload_pic', {
      method: 'POST',
      headers: {
        'Authentication-Token': authToken,
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadResult = await uploadResponse.text();
    console.log('FaceCheck response status:', uploadResponse.status);
    
    // Look for search ID in response
    const idMatch = uploadResult.match(/id_search=(\d+)/);
    
    if (!idMatch || !idMatch[1]) {
      // If no ID found, return error with details
      console.error('No search ID found in response');
      return res.status(400).json({ 
        error: 'FaceCheck upload failed',
        message: 'Could not get search ID from FaceCheck',
        facecheck_status: uploadResponse.status,
        response_preview: uploadResult.substring(0, 300),
        possible_issues: [
          'Token might be expired',
          'Image format not supported',
          'FaceCheck API changed'
        ]
      });
    }

    // We got a search ID!
    const searchId = idMatch[1];
    console.log('Success! Search ID:', searchId);

    // Return success with the search URL
    return res.status(200).json({
      success: true,
      search_id: searchId,
      results_url: `https://facecheck.id/search/${searchId}`,
      message: 'Face search started successfully!',
      next_steps: 'Visit the results_url to see matches',
      debug_info: {
        image_size: imageBuffer.length,
        upload_status: uploadResponse.status,
        search_id: searchId
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message,
      type: error.constructor.name,
      message: 'Something went wrong during face verification'
    });
  }
};
