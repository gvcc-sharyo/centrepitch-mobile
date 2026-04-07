import api, { getApiBaseUrl } from "./api";
import { getStore } from "../store/storeRef";

/**
 * Multipart upload via `fetch` — avoids axios + FormData issues on React Native Android
 * ("Network Error" with no response when Content-Type/boundary handling breaks).
 */
async function postUploadMultipart(relativePath, file) {
  const base = String(getApiBaseUrl()).replace(/\/$/, "");
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  const url = `${base}${path}`;

  const formData = new FormData();
  formData.append("file", file);

  const token = getStore()?.getState()?.auth?.token;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: formData });
  } catch (e) {
    const err = new Error(e?.message || "Network request failed");
    err.cause = e;
    throw err;
  }

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text.slice(0, 160) || "Invalid JSON from server");
    }
  }

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Upload failed (${res.status})`);
    err.response = { status: res.status, data };
    throw err;
  }
  return data;
}

const uploadService = {
  /** Event banner — `fetch` multipart (reliable on RN Android). */
  uploadEventImage: async (file) => postUploadMultipart("/upload/event-image", file),

  // Upload QR code image
  uploadQRCode: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/upload/qr-code', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  uploadProfilePhoto: async (file) => postUploadMultipart("/upload/profile-photo", file),

  // Upload team logo
  uploadTeamLogo: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/upload/team-logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Upload sport icon (admin)
  uploadSportIcon: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload/file?folder=sport_icons', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Upload sport cover image (admin)
  uploadSportImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/upload/file?folder=sport_images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Generic file upload
  uploadFile: async (file, folder = 'uploads') => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post(`/upload/file?folder=${folder}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
};

export default uploadService;