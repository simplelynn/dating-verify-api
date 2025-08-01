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

  // Debug: Log the entire request body
  console.log('Request body:', JSON.stringify(req.body));
  
  const { image_url } = req.body || {};
  
  // Debug: Log the extracted image_url
  console.log('Extracted image_url:', image_url);
  console.log('Type of image_url:', typeof image_url);

  if (!image_url) {
    return res.status(400).json({ 
      error: 'image_url is required',
      message: 'Please provide an image URL to verify',
      received: req.body
    });
  }

  // Validate URL format
  try {
    new URL(image_url);
  } catch (urlError) {
    return res.status(400).json({
      error: 'Invalid URL format',
      message: 'The image_url must be a valid URL',
      received_url: image_url,
      url_error: urlError.message
    });
  }

  try {
    console.log('Starting download from URL:', image_url);
    
    // Step 1: Download the image
    const imageResponse = await fetch(image_url);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }
    
    const imageBuffer = await imageResponse.buffer();
    console.log('Image downloaded, size:', imageBuffer.length);
    
    // Step 2: Create FormData with the image
    const formData = new FormData();
    formData.append('images', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg'
    });
    
    console.log('Uploading to FaceCheck.ID...');
    
    // Step 3: Upload to FaceCheck
    const uploadResponse = await fetch('https://facecheck.id/api/upload_pic', {
      method: 'POST',
      headers: {
        'Authentication-Token': 'wV1cRvip6IZSFLf5gS/3RZbSTc+Vq1DvSxuSifR0D7HokiBcLi0WUpRRg91Tad6bTaX4wq7I8Ak=',
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadResult = await uploadResponse.text();
    console.log('Upload response status:', uploadResponse.status);
    console.log('Upload response preview:', uploadResult.substring(0, 200));
    
    // Step 4: Parse the search ID from response
    const idMatch = uploadResult.match(/id_search=(\d+)/);
    
    if (!idMatch || !idMatch[1]) {
      return res.status(400).json({ 
        error: 'Failed to get search ID from FaceCheck',
        message: 'The upload may have failed. Check if your token is valid.',
        status: uploadResponse.status,
        response_preview: uploadResult.substring(0, 500)
      });
    }

    const searchId = idMatch[1];
    console.log('Got search ID:', searchId);

    // Return immediately with search URL
    return res.status(200).json({
      success: true,
      search_id: searchId,
      results_url: `https://facecheck.id/search/${searchId}`,
      message: 'Face search initiated. Results may take a moment to process.',
      debug: {
        image_url_used: image_url,
        search_id: searchId
      }
    });

  } catch (error) {
    console.error('Error in face verification:', error);
    return res.status(500).json({ 
      error: error.message,
      message: 'Failed to complete face verification',
      stack: error.stack,
      debug: {
        attempted_url: image_url,
        error_type: error.constructor.name
      }
    });
  }
};
