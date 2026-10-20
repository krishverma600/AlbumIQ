import { Link, useLocation } from 'react-router-dom';
import { useAppState } from '../../store/AppStateContext';

const pages = {
  '/admin/dashboard': ['Your studio', 'A clear view of your events and photos.'],
  '/admin/create-event': ['Create an event', 'Set up an album and invite your guests.'],
  '/admin/upload-photos': ['Photo manager', 'Upload, review, and share your event photos.'],
  '/admin/analytics': ['Event insights', 'See how your events are growing.'],
  '/admin/profile': ['Studio profile', 'Manage your details and contact information.'],
};
export default function AdminHeader() {
  const { pathname } = useLocation();
  const { adminSession } = useAppState();
  const [title, subtitle] = pages[pathname] || pages['/admin/dashboard'];
  return <header className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-[24px] border bg-white/80 px-5 py-4 sm:px-6">
    <div className="min-w-0"><h1 className="text-xl font-bold sm:text-2xl">{title}</h1><p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p></div>
    <Link to="/admin/profile" className="max-w-full truncate rounded-full border bg-white px-4 py-2 text-sm font-semibold">{adminSession.name}</Link>
  </header>;
}
