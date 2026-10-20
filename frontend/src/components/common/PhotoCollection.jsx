import { Download, Images, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Button from './Button';
import DownloadButton from './DownloadButton';
import GalleryModal from '../guest/GalleryModal';
import { downloadPhotos } from '../../utils/downloads';
import { formatStatusLabel } from '../../utils/formatters';

export default function PhotoCollection({ photos, title = 'Photos', description, showStatuses = false, emptyMessage = 'No photos yet.', archiveName = 'event-photos.zip' }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [previewId, setPreviewId] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState('');
  const filtered = useMemo(() => photos.filter((photo) => (photo.filename || photo.title || '').toLowerCase().includes(query.toLowerCase()) && (status === 'all' || photo.status === status)), [photos, query, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pageCount);
  const visible = showAll ? filtered : filtered.slice((currentPage - 1) * 12, currentPage * 12);
  const downloadable = filtered.filter((photo) => photo.image);
  const selectedPhotos = photos.filter((photo) => selected.has(photo.id) && photo.image);
  const previewPhotos = filtered.filter((photo) => photo.image);
  const previewIndex = previewPhotos.findIndex((photo) => photo.id === previewId);
  const preview = previewPhotos[previewIndex];
  useEffect(() => { setPage(1); }, [query, status, showAll]);
  async function downloadGroup(items) {
    if (!items.length || downloading) return;
    try { setDownloading(true); setProgress(`0 / ${items.length}`); await downloadPhotos(items, archiveName, (done, total) => setProgress(`${done} / ${total}`)); toast.success('Your photo download is ready.'); }
    catch (error) { toast.error(error.message || 'Download failed. Please try again.'); }
    finally { setDownloading(false); setProgress(''); }
  }
  return <section className="min-w-0 space-y-5" aria-label={title}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h2 className="text-2xl font-semibold">{title} <span className="text-base font-medium text-[var(--muted)]">({photos.length})</span></h2>{description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}</div>
      <div className="flex flex-wrap gap-2">
        {selectedPhotos.length ? <Button disabled={downloading} onClick={() => downloadGroup(selectedPhotos)}><Download size={16} className="mr-2" />Download selected ({selectedPhotos.length})</Button> : null}
        {downloadable.length ? <Button variant="secondary" disabled={downloading} onClick={() => downloadGroup(downloadable)}><Download size={16} className="mr-2" />{downloading ? `Preparing ${progress}` : `Download all${query || status !== 'all' ? ' filtered' : ''}`}</Button> : null}
      </div>
    </div>
    {photos.length > 0 ? <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white/70 p-3">
      <label className="flex min-w-[180px] flex-1 items-center gap-2"><Search size={17} className="shrink-0 text-[var(--muted)]" /><input aria-label="Search photos by filename" className="w-full min-w-0 bg-transparent py-1 text-sm outline-none" placeholder="Search photos" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {showStatuses ? <select aria-label="Filter photos by status" className="rounded-xl border bg-white px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{[...new Set(photos.map((photo) => photo.status).filter(Boolean))].map((value) => <option key={value} value={value}>{formatStatusLabel(value)}</option>)}</select> : null}
      {downloadable.length ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={downloadable.length > 0 && downloadable.every((photo) => selected.has(photo.id))} onChange={(event) => setSelected(event.target.checked ? new Set(downloadable.map((photo) => photo.id)) : new Set())} />Select all</label> : null}
      {photos.length > 12 ? <Button variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show 12 per page' : `View all ${filtered.length} photos`}</Button> : null}
    </div> : null}
    {visible.length ? <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 sm:gap-4">
      {visible.map((photo, index) => <article key={photo.id} className="min-w-0 overflow-hidden rounded-[22px] border bg-white shadow-sm">
        <div className="relative aspect-[4/3] bg-[#eee7df]">
          {photo.image ? <button type="button" aria-label={`Preview ${photo.title || 'photo'}`} className="h-full w-full" onClick={() => setPreviewId(photo.id)}><img loading="lazy" src={photo.image} alt={photo.title || 'Event photo'} className="h-full w-full object-contain" /></button> : <div className="flex h-full items-center justify-center gap-2 text-sm text-[var(--muted)]"><Images size={20} />Importing photo</div>}
          {photo.image ? <input aria-label={`Select ${photo.title || 'photo'}`} className="absolute left-3 top-3 h-5 w-5 accent-[var(--primary)]" type="checkbox" checked={selected.has(photo.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); event.target.checked ? next.add(photo.id) : next.delete(photo.id); return next; })} /> : null}
        </div>
        <div className="space-y-3 p-3 sm:p-4">
          <h3 className="truncate text-sm font-semibold" title={photo.filename || photo.title}>{photo.title || `Photo ${index + 1}`}</h3>
          {showStatuses ? <p className={`text-xs font-medium ${['FAILED', 'NO_FACES'].includes(photo.status) ? 'text-amber-800' : 'text-[var(--muted)]'}`}>{formatStatusLabel(photo.status)}{photo.status === 'COMPLETED' ? ` · ${photo.faceCount || 0} face(s)` : ''}</p> : null}
          {photo.error ? <p className="text-xs leading-5 text-amber-800">{photo.error}</p> : null}
          <div className="flex flex-wrap gap-2"><Button variant="ghost" className="!px-2 !py-2 !text-xs" disabled={!photo.image} onClick={() => setPreviewId(photo.id)}>Preview</Button><DownloadButton photo={photo} className="!px-3 !py-2 !text-xs" /></div>
        </div>
      </article>)}
    </div> : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-[var(--muted)]">{photos.length ? 'No photos match these filters.' : emptyMessage}</div>}
    {!showAll && filtered.length > 12 ? <nav aria-label="Photo pages" className="flex items-center justify-center gap-4"><Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button><span className="text-sm">Page {currentPage} of {pageCount}</span><Button variant="secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button></nav> : null}
    <GalleryModal item={preview} onClose={() => setPreviewId(null)} position={preview ? `${previewIndex + 1} of ${previewPhotos.length}` : ''} onPrevious={previewPhotos.length > 1 ? () => setPreviewId(previewPhotos[(previewIndex - 1 + previewPhotos.length) % previewPhotos.length].id) : undefined} onNext={previewPhotos.length > 1 ? () => setPreviewId(previewPhotos[(previewIndex + 1) % previewPhotos.length].id) : undefined} />
  </section>;
}
