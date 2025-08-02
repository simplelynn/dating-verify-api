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
  
  // Try multiple parameter names
  const photo_url = req.body?.photo_url || req.body?.image_url || req.body?.url;
  
  console.log('Extracted URL:', photo_url);

  // Check if we got a valid URL
  if (!photo_url || photo_url === 'null' || photo_url === null) {
    return res.status(400).json({ 
      error: 'No URL provided',
      message: 'Please provide a photo_url in the request',
      received_body: req.body
    });
  }

  // Validate URL format
  try {
    new URL(photo_url);
  } catch (urlError) {
    return res.status(400).json({
      error: 'Invalid URL format',
      message: 'The photo_url must be a valid URL',
      received_url: photo_url
    });
  }

  // Your NEW FaceCheck token
  const authToken = 'ZgfDWNYX+nI1X91g7Ee1SRz4k64y78/7B2G/vCjjsJm1Eob0gGS1fWphRX3x4m4HrToxwS6fEFU=';

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
    
    // Try different auth header formats
    // Format 1: Authorization: APIKEY token
    const uploadResponse = await fetch('https://facecheck.id/api/upload_pic', {
      method: 'POST',
      headers: {
        'Authorization': `APIKEY ${authToken}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadResult = await uploadResponse.text();
    console.log('FaceCheck response status:', uploadResponse.status);
    console.log('FaceCheck response preview:', uploadResult.substring(0, 500));
    
    // Try to parse as JSON first
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(uploadResult);
      console.log('Parsed JSON response:', parsedResponse);
    } catch (e) {
      // Not JSON, continue with HTML parsing
      console.log('Response is not JSON, checking for id_search in HTML');
    }

    // If we got a JSON error response
    if (parsedResponse && parsedResponse.error) {
      return res.status(400).json({
        error: 'FaceCheck API error',
        facecheck_error: parsedResponse.error,
        facecheck_message: parsedResponse.message,
        suggestion: 'Check if the API key format is correct'
      });
    }

    // Look for search ID in HTML response
    const idMatch = uploadResult.match(/id_search=(\d+)/);
    
    if (!idMatch || !idMatch[1]) {
      // If auth failed, try other header formats
      console.log('No search ID found, auth might have failed');
      
      return res.status(200).json({ 
        warning: 'No search ID found in response',
        facecheck_status: uploadResponse.status,
        facecheck_response: uploadResult,
        auth_format_used: 'Authorization: APIKEY token',
        note: 'If you see an auth error, the header format might need adjustment'
      });
    }

    // Success! We got a search ID
    const searchId = idMatch[1];
    console.log('Success! Search ID:', searchId);

    // Return success with the search URL
    return res.status(200).json({
      success: true,
      search_id: searchId,
      results_url: `https://facecheck.id/search/${searchId}`,
      message: 'Face search completed successfully!',
      credits_note: 'This search used 3 credits from your account',
      remaining_credits: 'Check your FaceCheck dashboard for remaining balance'
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
