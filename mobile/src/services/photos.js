import { api } from '../lib/api';

export async function uploadPhotos({ eventCode, files }) {
  const formData = new FormData();
  formData.append('event_code', eventCode);

  files.forEach((file, index) => {
    formData.append('images', {
      uri: file.uri,
      type: file.mimeType || 'image/jpeg',
      name: file.fileName || `upload-${index + 1}.jpg`,
    });
  });

  const { data } = await api.post('/photos/upload/', formData, {
    timeout: 120000,
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data;
}

export async function getUploadStatus(eventId) {
  const { data } = await api.get(`/photos/status/${eventId}/`);
  return data;
}

export async function importDrivePhotos({ eventCode, links }) {
  const { data } = await api.post('/photos/import-drive/', { event_code: eventCode, links });
  return data;
}
