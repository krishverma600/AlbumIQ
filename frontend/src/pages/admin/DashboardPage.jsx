import { CalendarPlus, Copy, ExternalLink, Search, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../../components/common/Button';
import StatCard from '../../components/common/StatCard';
import { listEvents } from '../../services/eventService';
import { formatDate, formatNumber } from '../../utils/formatters';
import { useAppState } from '../../store/AppStateContext';

export default function DashboardPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const { setSelectedAdminEventId } = useAppState();
  useEffect(() => { let cancelled = false;
    listEvents().then((data) => { if (!cancelled) setEvents([...data].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))); }).catch(() => toast.error('Could not load events. Please refresh and try again.')).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const filtered = useMemo(() => events.filter((event) => `${event.event_name} ${event.event_code}`.toLowerCase().includes(query.toLowerCase())), [events, query]);
  const latest = events[0];
  const stats = [
    { label: 'Events', value: formatNumber(events.length), change: 'Created by your studio' },
    { label: 'Photos uploaded', value: formatNumber(events.reduce((sum, event) => sum + (event.photo_count || 0), 0)), change: 'Across all your albums' },
    { label: 'Latest event', value: latest?.event_code || '—', change: latest?.event_name || 'Create your first event' },
    { label: 'Guest access', value: latest ? 'Ready to share' : 'Not set up', change: latest ? 'Share an event code or QR' : 'Available after creating an event' },
  ];
  async function copyLink(event) {
    try { await navigator.clipboard.writeText(`${window.location.origin}/event/${event.event_code}`); toast.success('Guest link copied'); }
    catch { toast.error('Could not copy the link. Open the guest page and copy its address.'); }
  }
  return <section className="min-w-0 space-y-6">
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <StatCard key={stat.label} {...stat} />)}</div>
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(240px,1fr)]">
      <section className="glass-panel min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-semibold">Your events</h2><Link to="/admin/create-event"><Button><CalendarPlus size={16} className="mr-2" />Create event</Button></Link></div>
        <label className="mt-5 flex items-center gap-2 rounded-2xl border bg-white px-4 py-3"><Search size={18} className="shrink-0 text-[var(--muted)]" /><input type="search" aria-label="Search events" className="w-full min-w-0 bg-transparent text-sm outline-none" placeholder="Search by event name or code" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="mt-5 space-y-4">
          {loading ? <p role="status" className="text-sm text-[var(--muted)]">Loading your events...</p> : null}
          {!loading && !filtered.length ? <p className="rounded-2xl border border-dashed p-6 text-sm text-[var(--muted)]">{events.length ? 'No events match your search.' : 'Create your first event to start building an album.'}</p> : null}
          {filtered.map((event) => <article key={event.id} className="min-w-0 rounded-[22px] border bg-white/90 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-xl font-semibold">{event.event_name}</h3><p className="mt-1 text-sm text-[var(--muted)]">{formatDate(event.event_date)} · {event.event_code}</p></div><span className="shrink-0 rounded-full bg-[rgba(40,123,98,.1)] px-3 py-1 text-xs font-semibold text-[var(--success)]">{formatNumber(event.photo_count || 0)} photos</span></div>
            <div className="mt-4 flex flex-wrap gap-2"><Link to="/admin/upload-photos" onClick={() => setSelectedAdminEventId(event.id)}><Button className="!px-4 !py-2 !text-xs">Manage photos</Button></Link><Button variant="secondary" className="!px-4 !py-2 !text-xs" onClick={() => copyLink(event)}><Copy size={14} className="mr-1" />Copy guest link</Button><Link className="inline-flex items-center gap-1 px-2 text-sm text-[var(--primary)]" to={`/event/${event.event_code}`}><ExternalLink size={14} />Guest page</Link></div>
          </article>)}
        </div>
      </section>
      <aside className="glass-panel min-w-0"><h2 className="text-xl font-semibold">A great guest experience</h2><ol className="mt-5 space-y-5 text-sm leading-6 text-[var(--muted)]"><li><strong className="block text-[var(--text)]">1. Create your event</strong>Add the event details and get a unique code and QR.</li><li><strong className="block text-[var(--text)]">2. Add your photos</strong>Upload from your device or import shared Google Drive photos.</li><li><strong className="block text-[var(--text)]">3. Share with guests</strong>Guests use a selfie to find and download their photos.</li></ol><Link className="mt-6 block" to="/admin/upload-photos"><Button className="w-full"><UploadCloud size={17} className="mr-2" />Manage photos</Button></Link></aside>
    </div>
  </section>;
}
