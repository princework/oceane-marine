/**
 * API helpers for STS Checklist forms.
 * Submissions go to the main application (Oceane-Marine) API;
 * data is stored there and listed in the main app.
 */

import { API_BASE_URL } from './config';

async function parseJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: response.statusText || 'Invalid response' };
  }
}

/**
 * Submit Declaration of Sea form (JSON body).
 * POST to declaration-of-sea/create
 */
export async function submitDeclarationOfSea(body) {
  const url = `${API_BASE_URL}/declaration-of-sea/create`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      err.message === 'Failed to fetch'
        ? 'Cannot reach the server. Is the main app (Oceane-Marine) running? Check .env.local NEXT_PUBLIC_API_BASE_URL1.'
        : err.message
    );
  }
  const result = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(result.error || 'Failed to submit declaration');
  }
  return result;
}

/**
 * Submit a checklist form using FormData (data + optional signature file).
 * POST to {apiPath}/create
 * @param {string} apiPath - e.g. 'ops-ofd-001', 'ops-ofd-001a'
 * @param {object} data - Form payload (will be JSON stringified under 'data')
 * @param {File|null} signatureFile - Optional file for signature (if not provided, signature can be in data as base64)
 */
export async function submitChecklistForm(apiPath, data, signatureFile = null) {
  const formData = new FormData();
  formData.append('data', JSON.stringify(data));

  if (signatureFile && signatureFile instanceof File && signatureFile.name) {
    formData.append('signature', signatureFile);
  }

  const url = `${API_BASE_URL}/${apiPath}/create`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
  } catch (err) {
    throw new Error(
      err.message === 'Failed to fetch'
        ? 'Cannot reach the server. Is the main app (Oceane-Marine) running? Check .env.local NEXT_PUBLIC_API_BASE_URL1.'
        : err.message
    );
  }
  const result = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(result.error || `Failed to submit ${apiPath}`);
  }
  return result;
}

/**
 * Convert a base64 data URL to a File (e.g. for signature upload).
 * Use when the API expects a file; otherwise send base64 in JSON.
 */
export function dataURLtoFile(dataUrl, filename = 'signature.png') {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}
