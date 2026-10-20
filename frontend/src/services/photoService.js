import api from "./api";

export async function importDrivePhotos({ eventCode, links }) {
  const { data } = await api.post("/photos/import-drive/", { event_code: eventCode, links });
  return data;
}

export async function uploadPhotos({ eventCode, files }) {
  const formData = new FormData();
  formData.append("event_code", eventCode);

  files.forEach((file) => {
    formData.append("images", file);
  });

  const { data } = await api.post("/photos/upload/", formData, {
    timeout: 120000,
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return data;
}


export async function getUploadStatus(eventId) {
  const { data } = await api.get(`/photos/status/${eventId}/`);
  return data;
}

