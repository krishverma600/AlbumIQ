import { Copy, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import Button from '../../components/common/Button';
import DownloadButton from '../../components/common/DownloadButton';
import PhotoCollection from '../../components/common/PhotoCollection';
import DrivePhotoImport from '../../components/admin/DrivePhotoImport';
import SelfieDropzone from '../../components/guest/SelfieDropzone';
import { listEvents } from '../../services/eventService';
import { getUploadStatus, uploadPhotos } from '../../services/photoService';
import { useAppState } from '../../store/AppStateContext';

export default function UploadPhotosPage() {
  const { selectedAdminEventId, setSelectedAdminEventId } = useAppState();
  const [events, setEvents] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [source, setSource] = useState('local');
  const selectedEvent = events.find((event) => String(event.id) === String(selectedAdminEventId)) || events[0];

  useEffect(() => {
    let cancelled = false;
    listEvents().then((data) => { if (!cancelled) setEvents(data); }).catch(() => toast.error('Could not load your events. Please refresh and try again.')).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false, timer;
    setStatusData(null); setStatusError(''); setSelectedFiles([]);
    async function loadStatus() {
      if (!selectedEvent?.id) return;
      try { const data = await getUploadStatus(selectedEvent.id); if (!cancelled) { setStatusData(data); setStatusError(''); } }
      catch { if (!cancelled) setStatusError('Could not refresh photo status. Retrying shortly.'); }
      finally { if (!cancelled) timer = window.setTimeout(loadStatus, 5000); }
    }
    loadStatus();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [selectedEvent?.id]);

  const photos = useMemo(() => (statusData?.photos || []).map((photo) => ({
    id: photo.id, image: photo.image_url, filename: photo.original_filename,
    title: photo.original_filename || `Photo ${photo.id}`, status: photo.processing_status,
    faceCount: photo.face_count, error: photo.processing_error,
  })), [statusData]);
  const selectedPreviews = useMemo(() => selectedFiles.map((file, index) => ({ id: `selected-${index}`, image: URL.createObjectURL(file), filename: file.name, title: file.name })), [selectedFiles]);
  useEffect(() => () => selectedPreviews.forEach((photo) => URL.revokeObjectURL(photo.image)), [selectedPreviews]);

  async function upload() {
    if (!selectedEvent || !selectedFiles.length || isUploading) return;
    const event = selectedEvent;
    try {
      setIsUploading(true);
      const data = await uploadPhotos({ eventCode: event.event_code, files: selectedFiles });
      setSelectedFiles([]);
      if (data.failed) toast.error(`${data.failed} photo(s) need attention. See the photo list below.`);
      else toast.success(`${data.queued} photos uploaded. We’re preparing them for guest search.`);
      const refreshed = await getUploadStatus(event.id).catch(() => null);
      if (refreshed) setStatusData(refreshed);
    } catch (error) { toast.error(error?.response?.data?.detail || error?.response?.data?.images?.[0] || 'Upload failed. Please try again.'); }
    finally { setIsUploading(false); }
  }

  return <section className="min-w-0 space-y-6">
    <div className="glass-panel min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="pill">Your event album</p><h1 className="mt-3 text-2xl font-semibold sm:text-3xl">Upload & manage photos</h1><p className="mt-2 text-sm text-[var(--muted)]">Choose an event, add photos, and review your album below.</p></div>
        <Link to="/admin/create-event"><Button variant="secondary">Create event</Button></Link>
      </div>
      <div className="mt-5 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0"><label className="field-label" htmlFor="upload-event">Selected event</label><select id="upload-event" className="field-input mt-2" disabled={isUploading || loading || !events.length} value={selectedEvent?.id || ''} onChange={(event) => setSelectedAdminEventId(event.target.value)}>{!events.length ? <option value="">{loading ? 'Loading events...' : 'Create an event to start uploading'}</option> : events.map((event) => <option key={event.id} value={event.id}>{event.event_name} · {event.event_code}</option>)}</select>
        {selectedEvent ? <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span className="font-semibold">{selectedEvent.event_code}</span><button className="inline-flex items-center gap-1 text-[var(--primary)]" onClick={async () => { try { await navigator.clipboard.writeText(selectedEvent.event_code); toast.success('Event code copied'); } catch { toast.error('Could not copy. Please select and copy the event code.'); } }}><Copy size={14} />Copy code</button><Link className="text-[var(--primary)] underline" to={`/event/${selectedEvent.event_code}`}>Open guest page</Link></div> : null}</div>
        {selectedEvent?.qr_url ? <div className="flex items-center gap-3 rounded-2xl border bg-white p-3"><img className="h-20 w-20 object-contain" alt="Event QR code" src={selectedEvent.qr_url} /><DownloadButton photo={{ id: selectedEvent.id, image: selectedEvent.qr_url, filename: `${selectedEvent.event_code}-QR.png` }} className="!px-3 !py-2 !text-xs" /></div> : null}
      </div>
    </div>
    <div className="glass-panel min-w-0">
      <div className="mb-5 flex flex-wrap gap-2" aria-label="Photo upload source"><Button variant={source === 'local' ? 'primary' : 'secondary'} onClick={() => setSource('local')} aria-pressed={source === 'local'}>Upload from device</Button><Button variant={source === 'drive' ? 'primary' : 'secondary'} onClick={() => setSource('drive')} aria-pressed={source === 'drive'}>Import from Google Drive</Button></div>
      {source === 'drive' ? <DrivePhotoImport key={selectedEvent?.event_code || 'no-event'} eventCode={selectedEvent?.event_code} /> : <>
        <SelfieDropzone capture={false} multiple title="Choose event photos" description="Drag photos here or click to choose them from your device." helperText="JPG, PNG or WEBP · Select multiple photos" onFilesSelected={setSelectedFiles} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[var(--muted)]">{selectedFiles.length ? `${selectedFiles.length} photos selected` : 'No photos selected'}</p><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={!selectedFiles.length || isUploading} onClick={() => setSelectedFiles([])}>Clear selection</Button><Button disabled={!selectedEvent || !selectedFiles.length || isUploading} onClick={upload}><Upload size={16} className="mr-2" />{isUploading ? 'Uploading photos...' : 'Upload photos'}</Button></div></div>
        {selectedPreviews.length ? <div className="mt-5 border-t pt-5"><PhotoCollection photos={selectedPreviews} title="Selected photos" description="Review your selection before uploading." archiveName="selected-photos.zip" /></div> : null}
      </>}
    </div>
    <div className="glass-panel min-w-0">
      {statusError ? <p role="status" className="mb-4 text-sm text-amber-800">{statusError}</p> : null}
      <PhotoCollection key={selectedEvent?.id || 'none'} photos={photos} showStatuses title="Event photos" description="Preview, filter, and download your album. Photos become searchable when face processing is complete." emptyMessage={loading ? 'Loading your photos...' : 'No photos uploaded for this event yet.'} archiveName={`${selectedEvent?.event_code || 'event'}-photos.zip`} />
    </div>
  </section>;
}
