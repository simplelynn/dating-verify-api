import FormData from 'form-data';
import fetch from 'node-fetch';

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
  
  // Your FaceCheck authentication token
  const authToken = 'wV1cRvip6IZSFLf5gS/3RZbSTc+Vq1DvSxuSifR0D7HokiBcLi0WUpRRg91Tad6bTaX4wq7I8Ak=';

  if (!image_url) {
    return res.status(400).json({ 
      error: 'image_url is required',
      message: 'Please provide an image URL to verify'
    });
  }

  try {
    console.log('Starting verification for:', image_url);
    
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
        'Authentication-Token': authToken,
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadResult = await uploadResponse.text();
    console.log('Upload response status:', uploadResponse.status);
    
    // Step 4: Parse the search ID from response
    const idMatch = uploadResult.match(/id_search=(\d+)/);
    
    if (!idMatch || !idMatch[1]) {
      console.error('Response:', uploadResult.substring(0, 500));
      return res.status(400).json({ 
        error: 'Failed to get search ID from FaceCheck',
        message: 'The upload may have failed. Check if your token is valid.',
        status: uploadResponse.status
      });
    }

    const searchId = idMatch[1];
    console.log('Got search ID:', searchId);

    // Step 5: Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Get results
    const resultsResponse = await fetch(`https://facecheck.id/api/search_pic?id_search=${searchId}`, {
      headers: {
        'Authentication-Token': authToken
      }
    });

    let searchResults;
    const resultsText = await resultsResponse.text();
    
    try {
      searchResults = JSON.parse(resultsText);
    } catch (e) {
      searchResults = {
        status: 'processing',
        message: 'Results still processing, check URL',
        raw: resultsText.substring(0, 200)
      };
    }
    
    // Return results
    return res.status(200).json({
      success: true,
      search_id: searchId,
      results_url: `https://facecheck.id/search/${searchId}`,
      results: searchResults,
      message: 'Face search completed successfully'
    });

  } catch (error) {
    console.error('Error in face verification:', error);
    return res.status(500).json({ 
      error: error.message,
      message: 'Failed to complete face verification',
      details: error.stack
    });
  }
}
