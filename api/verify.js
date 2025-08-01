const FormData = require('form-data');
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Accept different possible param names
  const photo_url = req.body?.photo_url || req.body?.image_url || req.body?.url;

  if (!photo_url || photo_url === 'null' || photo_url === null) {
    return res.status(400).json({
      error: 'No photo_url provided',
      message: 'You must send a JSON object like: { "photo_url": "https://..." }'
    });
  }

  try {
    new URL(photo_url); // validate URL
  } catch {
    return res.status(400).json({
      error: 'Invalid URL format',
      received: photo_url
    });
  }

  const authToken = process.env.FACECHECK_API_KEY;
  if (!authToken) {
    return res.status(500).json({
      error: 'Missing FaceCheck API Key in environment variable FACECHECK_API_KEY'
    });
  }

  // Debug log for confirmation (only log first 6 characters)
  console.log("Using FaceCheck API Key:", authToken.slice(0, 6) + '...');

  try {
    console.log('Downloading image from:', photo_url);
    const imageResponse = await fetch(photo_url);

    if (!imageResponse.ok) {
      return res.status(400).json({
        error: 'Failed to download image',
        image_status: imageResponse.status,
        url: photo_url
      });
    }

    const imageBuffer = await imageResponse.buffer();

    const formData = new FormData();
    formData.append('images', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg'
    });

    console.log('Uploading to FaceCheck.ID...');

    const uploadResponse = await fetch('https://facecheck.id/api/upload_pic', {
      method: 'POST',
      headers: {
        Authorization: `APIKEY ${authToken}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadText = await uploadResponse.text();

    // Debug log: show FaceCheck's full raw response
    console.log('FaceCheck response status:', uploadResponse.status);
    console.log('FaceCheck raw response:', uploadText);

    const match = uploadText.match(/id_search=(\d+)/);
    if (!match || !match[1]) {
      return res.status(200).json({
        warning: 'No search ID found',
        facecheck_status: uploadResponse.status,
        facecheck_response: uploadText,
        note: 'Check if the response mentions an invalid API key or token'
      });
    }

    const searchId = match[1];
    return res.status(200).json({
      success: true,
      search_id: searchId,
      results_url: `https://facecheck.id/search/${searchId}`,
      message: 'Face search started successfully!'
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({
      error: err.message,
      type: err.constructor.name,
      message: 'Internal server error during face verification'
    });
  }
};
