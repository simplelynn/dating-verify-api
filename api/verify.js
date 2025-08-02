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

  // Your FaceCheck token
  const APITOKEN = 'huq5OCTr3CQEz0bheSPnG+Hd4KCWvQfibpQ+B2HrbrVBHtK3JkuiILcLF8zmdBI0nQvBmMTsji0=';
  const TESTING_MODE = false; // Set to false to use real credits

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
    
    // Create form data (matching the official example)
    const form = new FormData();
    form.append('images', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg'
    });
    form.append('id_search', ''); // Add empty id_search like in example
    
    console.log('Uploading to FaceCheck.ID...');
    
    // Upload to FaceCheck (following official example format)
    const uploadResponse = await fetch('https://facecheck.id/api/upload_pic', {
      method: 'POST',
      headers: {
        ...form.getHeaders(),
        'accept': 'application/json',
        'Authorization': APITOKEN
      },
      body: form
    });

    // Parse JSON response
    const uploadResult = await uploadResponse.json();
    console.log('FaceCheck upload response:', uploadResult);
    
    // Check for errors
    if (uploadResult.error) {
      return res.status(400).json({
        error: 'FaceCheck API error',
        facecheck_error: uploadResult.error,
        facecheck_code: uploadResult.code,
        message: 'Upload failed - check if token is valid'
      });
    }

    // Get the search ID from JSON response
    const id_search = uploadResult.id_search;
    
    if (!id_search) {
      return res.status(400).json({
        error: 'No search ID returned',
        message: 'FaceCheck did not return a search ID',
        response: uploadResult
      });
    }

    console.log(`Success! ${uploadResult.message} id_search=${id_search}`);

    // Now search for results (following official example)
    const searchData = {
      id_search: id_search,
      with_progress: true,
      status_only: false,
      demo: TESTING_MODE
    };

    // Wait a moment before checking results
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get search results
    console.log('Checking search results...');
    const searchResponse = await fetch('https://facecheck.id/api/search', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Authorization': APITOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchData)
    });

    const searchResult = await searchResponse.json();
    console.log('Search response:', searchResult);

    // Check if results are ready
    let finalResults = null;
    if (searchResult.output && searchResult.output.items) {
      finalResults = searchResult.output.items;
      console.log(`Found ${finalResults.length} matches`);
    }

    // Return comprehensive response
    return res.status(200).json({
      success: true,
      message: 'Face search initiated successfully!',
      search_id: id_search,
      results_url: `https://facecheck.id/search/${id_search}`,
      search_progress: searchResult.progress || 0,
      search_message: searchResult.message,
      matches: finalResults,
      credits_used: TESTING_MODE ? 0 : 3,
      testing_mode: TESTING_MODE,
      image_info: {
        url: photo_url,
        size: imageBuffer.length
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
