import { ArrowLeft, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import Loader from '../../components/common/Loader';
import PhotoCollection from '../../components/common/PhotoCollection';
import { searchPhotos } from '../../services/searchService';
import { useAppState } from '../../store/AppStateContext';

export default function GalleryPage() {
  const { eventCode } = useParams();
  const code = eventCode?.toUpperCase();
  const { guestFlow, guestSelfieFile, setGuestResults } = useAppState();
  const [isSearching, setIsSearching] = useState(false);
  const runSearch = useCallback(async (signal) => {
    if (!guestSelfieFile || guestFlow.eventCode !== code) return;
    try {
      setIsSearching(true);
      const data = await searchPhotos({ eventCode: code, selfie: guestSelfieFile, signal });
      if (signal?.aborted) return;
      setGuestResults({
        matches: data.matched_images.map((photo, index) => ({ id: photo.photo_id, image: photo.image_url, filename: photo.filename, title: `Photo ${index + 1}` })),
        matchedCount: data.matched_count, searchId: data.search_id, albumStatus: data.album_status,
      });
    } catch (error) {
      if (signal?.aborted) return;
      const detail = error?.response?.data?.detail || 'We could not search your photos. Please try again.';
      setGuestResults({ matches: [], matchedCount: 0, searchId: '', searchError: detail });
      toast.error(detail);
    } finally { if (!signal?.aborted) setIsSearching(false); }
  }, [code, guestFlow.eventCode, guestSelfieFile, setGuestResults]);
  useEffect(() => { const controller = new AbortController(); runSearch(controller.signal); return () => controller.abort(); }, [runSearch]);
  const matches = useMemo(() => guestFlow.eventCode === code ? guestFlow.matches || [] : [], [code, guestFlow.eventCode, guestFlow.matches]);
  const album = guestFlow.albumStatus;
  return <section className="page-shell">
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="glass-panel flex min-w-0 flex-wrap items-center justify-between gap-4">
        <div><p className="pill">Your event memories</p><h1 className="section-heading mt-4">{isSearching ? 'Finding your photos...' : 'Your matching photos'}</h1><p className="mt-3 text-sm text-[var(--muted)]">Event {code} · {isSearching ? 'Searching faces in the event album' : `${matches.length} matching ${matches.length === 1 ? 'photo' : 'photos'}`}</p></div>
        <Link to={`/upload-selfie/${code}`}><Button variant="secondary"><ArrowLeft size={17} className="mr-2" />Change selfie</Button></Link>
      </header>
      {isSearching ? <div className="glass-panel" role="status"><Loader label="Looking for your face in the event photos..." /></div> : null}
      {!isSearching && guestFlow.searchError ? <div className="glass-panel"><h2 className="text-xl font-semibold">We couldn’t complete your search</h2><p className="mt-2 text-sm text-[var(--muted)]">{guestFlow.searchError}</p>{guestSelfieFile ? <Button className="mt-4" onClick={() => runSearch()}><RefreshCcw size={16} className="mr-2" />Try again</Button> : null}</div> : null}
      {!isSearching && !guestFlow.searchError && !matches.length ? <div className="glass-panel"><h2 className="text-xl font-semibold">{guestSelfieFile ? 'No matching photos found yet' : 'Add a selfie to find your photos'}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{guestSelfieFile ? 'Try a clear, front-facing photo. Your photos may still be processing, or this person may not appear in the selected event album.' : 'Choose a reference photo or take a live selfie to search this event.'}</p>{album ? <p className="mt-3 text-sm text-[var(--muted)]">{album.searchable} of {album.total} photos ready to search · {album.pending} processing · {album.no_faces} without a detected face</p> : null}<div className="mt-4 flex flex-wrap gap-3"><Link to={`/upload-selfie/${code}`}><Button>Choose a selfie</Button></Link>{guestSelfieFile ? <Button variant="secondary" onClick={() => runSearch()}>Search again</Button> : null}</div></div> : null}
      {!isSearching && matches.length > 0 ? <div className="glass-panel"><PhotoCollection key={code} photos={matches} title="Your photos" description="Select your favourites, preview the full photo, or download everything as a ZIP." archiveName={`${code}-my-photos.zip`} /></div> : null}
    </div>
  </section>;
}
