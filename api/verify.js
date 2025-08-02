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
  
  // Try multiple parameter names (photo_url, image_url, url)
  const photo_url = req.body?.photo_url || req.body?.image_url || req.body?.url;
  
  console.log('Extracted URL:', photo_url);
  console.log('Type:', typeof photo_url);

  // Check if we got a valid URL
  if (!photo_url || photo_url === 'null' || photo_url === null) {
    return res.status(400).json({ 
      error: 'No URL provided',
      message: 'Please provide a photo_url in the request',
      received_body: req.body,
      tip: 'Make sure to send {"photo_url": "https://example.com/image.jpg"}'
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

  // Your CORRECT FaceCheck token
  const authToken = 'ZgfDWNfX+nI1X91g7Ee1SRz4k64y79/7B2G/vCjjsJm1Eob0gGS1fWphRX3x4m4HrToxwS6fEFU=';

  try {
    console.log('Starting FaceCheck verification...');
    console.log('Downloading image from:', photo_url);
    
    // Step 1: Download the image
    const imageResponse = await fetch(photo_url);
    
    if (!imageResponse.ok) {
      return res.status(400).json({
        error: 'Failed to download image',
        status: imageResponse.status,
        url: photo_url,
        message: 'Make sure the image URL is publicly accessible'
      });
    }
    
    // Get image as buffer
    const imageBuffer = await imageResponse.buffer();
    console.log('Image downloaded successfully, size:', imageBuffer.length);
    
    // Step 2: Create form data with the image
    const formData = new FormData();
    formData.append('images', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg'
    });
    
    console.log('Uploading to FaceCheck.ID...');
    
    // Step 3: Upload to FaceCheck with CORRECT authentication format
    const uploadResponse = await fetch('https://facecheck.id/api/upload_pic', {
      method: 'POST',
      headers: {
        'Authorization': authToken,  // Just the token, no prefix!
        'accept': 'application/json',
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadResult = await uploadResponse.text();
    console.log('FaceCheck response status:', uploadResponse.status);
    
    // Log first part of response for debugging
    console.log('FaceCheck response preview:', uploadResult.substring(0, 300));
    
    // Try to parse as JSON first (in case of error)
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(uploadResult);
      if (jsonResponse.error) {
        return res.status(400).json({
          error: 'FaceCheck API error',
          facecheck_error: jsonResponse.error,
          message: jsonResponse.message || 'Authentication or upload failed'
        });
      }
    } catch (e) {
      // Not JSON, continue with HTML parsing
    }

    // Step 4: Look for search ID in the response
    const idMatch = uploadResult.match(/id_search=(\d+)/);
    
    if (!idMatch || !idMatch[1]) {
      // No search ID found
      console.error('No search ID found in FaceCheck response');
      return res.status(400).json({ 
        error: 'Failed to get search ID',
        message: 'FaceCheck did not return a search ID',
        facecheck_status: uploadResponse.status,
        response_preview: uploadResult.substring(0, 500),
        note: 'This might mean the upload failed or token is invalid'
      });
    }

    // Step 5: Success! We got a search ID
    const searchId = idMatch[1];
    console.log('Success! Got search ID:', searchId);
    console.log('Face search initiated, used 3 credits');

    // Step 6: Wait a bit for initial processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 7: Try to get initial results
    console.log('Fetching search results...');
    const resultsResponse = await fetch(`https://facecheck.id/api/search?id_search=${searchId}`, {
      headers: {
        'Authorization': authToken,
        'accept': 'application/json'
      }
    });

    let searchResults = null;
    if (resultsResponse.ok) {
      try {
        searchResults = await resultsResponse.json();
        console.log('Got search results');
      } catch (e) {
        console.log('Results not ready yet');
      }
    }

    // Return success with all the info
    return res.status(200).json({
      success: true,
      message: 'Face search completed successfully! 🎉',
      search_id: searchId,
      results_url: `https://facecheck.id/search/${searchId}`,
      api_results_url: `https://facecheck.id/api/search?id_search=${searchId}`,
      search_results: searchResults,
      credits_used: 3,
      remaining_credits: '292 credits remaining',
      next_steps: 'Visit results_url to see matches or call api_results_url',
      image_info: {
        url: photo_url,
        size: imageBuffer.length
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ 
      error: error.message,
      type: error.constructor.name,
      message: 'Something went wrong during face verification',
      tip: 'Check Vercel logs for more details'
    });
  }
};
