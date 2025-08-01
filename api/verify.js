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
    
    // Step 1: Download the image from URL
    const imageResponse = await fetch(image_url);
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    console.log('Image downloaded, size:', imageBuffer.byteLength);
    
    // Step 2: Upload to FaceCheck.ID
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('images', blob, 'image.jpg');
    
    console.log('Uploading to FaceCheck.ID...');
    
    const uploadResponse = await fetch('https://facecheck.id/api/upload_pic', {
      method: 'POST',
      headers: {
        'Authentication-Token': authToken
      },
      body: formData
    });

    const uploadResult = await uploadResponse.text();
    console.log('Upload response status:', uploadResponse.status);
    
    // Step 3: Parse the ID from response
    // FaceCheck returns HTML with id_search parameter
    const idMatch = uploadResult.match(/id_search=(\d+)/);
    
    if (!idMatch || !idMatch[1]) {
      console.error('Could not find id_search in response');
      return res.status(400).json({ 
        error: 'Failed to get search ID from FaceCheck',
        message: 'The image was uploaded but no search ID was returned'
      });
    }

    const searchId = idMatch[1];
    console.log('Got search ID:', searchId);

    // Step 4: Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 5: Get search results
    console.log('Fetching search results...');
    const resultsResponse = await fetch(`https://facecheck.id/api/search_pic?id_search=${searchId}`, {
      headers: {
        'Authentication-Token': authToken
      }
    });

    const resultsText = await resultsResponse.text();
    
    // Try to parse as JSON
    let searchResults;
    try {
      searchResults = JSON.parse(resultsText);
    } catch (e) {
      // If not JSON, return the search URL for manual checking
      console.log('Results not in JSON format');
      searchResults = {
        message: 'Search completed - check results at URL',
        results_url: `https://facecheck.id/search/${searchId}`,
        raw_response: resultsText.substring(0, 200) + '...'
      };
    }
    
    // Step 6: Return results to Bubble
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
      message: 'Failed to complete face verification'
    });
  }
}
