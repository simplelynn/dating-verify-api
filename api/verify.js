const FormData = require('form-data');
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const photo_url = req.body?.photo_url || req.body?.image_url || req.body?.url;
  if (!photo_url || photo_url === 'null' || photo_url === null) {
    return res.status(400).json({
      error: 'No URL provided',
      message: 'Please provide a photo_url in the request',
      received_body: req.body,
      tip: 'Make sure Bubble is sending the parameter correctly'
    });
  }

  try {
    new URL(photo_url); // Validate it's a real URL
  } catch {
    return res.status(400).json({
      error: 'Invalid URL format',
      message: 'The photo_url must be a valid URL',
      received_url: photo_url
    });
  }

  const authToken = process.env.FACECHECK_API_KEY;

  try {
    const imageResponse = await fetch(photo_url);
    if (!imageResponse.ok) {
      return res.status(400).json({
        error: 'Failed to download image',
        status: imageResponse.status,
        url: photo_url
      });
    }

    const imageBuffer = await imageResponse.buffer();
    const formData = new FormData();
    formData.append('images', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg'
    });

    const uploadResponse = await fetch('https://facecheck.id/api/upload_pic', {
      method: 'POST',
      headers: {
        Authorization: `APIKEY ${authToken}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadResult = await uploadResponse.text();
    const idMatch = uploadResult.match(/id_search=(\d+)/);

    if (!idMatch || !idMatch[1]) {
      return res.status(200).json({
        warning: 'No search ID found, but here is what FaceCheck returned',
        facecheck_status: uploadResponse.status,
        facecheck_response: uploadResult,
        note: 'Check if the response mentions authentication or other errors'
      });
    }

    const searchId = idMatch[1];

    return res.status(200).json({
      success: true,
      search_id: searchId,
      results_url: `https://facecheck.id/search/${searchId}`,
      message: 'Face search started successfully!',
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
