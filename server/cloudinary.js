const crypto = require('crypto');

const CLOUDINARY_API = 'https://api.cloudinary.com/v1_1';

function config() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

function isConfigured() {
  return !!config();
}

// Cloudinary signed upload: sha1 of the signed params (sorted, joined by &)
// concatenated with the API secret. file, api_key, resource_type and the
// signature itself are never part of the signature.
function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

async function uploadImage(buffer, { filename, folder, timestamp } = {}) {
  const cfg = config();
  if (!cfg) throw new Error('Cloudinary is not configured.');

  const ts = timestamp || Math.floor(Date.now() / 1000);
  const uploadFolder = folder || process.env.CLOUDINARY_UPLOAD_FOLDER || 'bkd';

  const signedParams = { folder: uploadFolder, timestamp: ts };
  const signature = signParams(signedParams, cfg.apiSecret);

  const form = new FormData();
  form.append('file', new Blob([buffer]), filename || 'upload');
  form.append('api_key', cfg.apiKey);
  form.append('timestamp', String(ts));
  form.append('folder', uploadFolder);
  form.append('signature', signature);

  const res = await fetch(`${CLOUDINARY_API}/${cfg.cloudName}/image/upload`, {
    method: 'POST',
    body: form
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try { message = JSON.parse(text)?.error?.message || text; } catch (_) {}
    const err = new Error(`Cloudinary upload failed: ${message}`);
    err.status = res.status === 400 ? 400 : 502;
    throw err;
  }

  const data = JSON.parse(text);
  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    format: data.format,
    bytes: data.bytes
  };
}

module.exports = { isConfigured, uploadImage };
