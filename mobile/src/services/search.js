import { api } from '../lib/api';

export async function searchPhotos({ eventCode, selfie }) {
  const formData = new FormData();
  formData.append('event_code', eventCode);
  formData.append('selfie', {
    uri: selfie.uri,
    type: selfie.mimeType || 'image/jpeg',
    name: selfie.fileName || 'selfie.jpg',
  });

  const { data } = await api.post('/search/', formData, {
    skipAuth: true,
    timeout: 120000,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
