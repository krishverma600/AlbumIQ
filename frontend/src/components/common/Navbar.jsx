import { HeartHandshake, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Button from './Button';

export default function Navbar({ links = [], rightSlot, admin = false }) {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 lg:px-10">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-[26px] border bg-[rgba(255,250,246,.94)] px-4 py-3 shadow-sm backdrop-blur-xl sm:px-6">
      <Link className="flex min-w-0 items-center gap-3" to={admin ? '/admin/dashboard' : '/'} onClick={() => setOpen(false)}><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-white"><HeartHandshake size={20} /></div><div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-[.15em] text-[var(--primary)]">FindMyShaadi Pics</p><p className="hidden text-sm font-semibold sm:block">Wedding memories, found with care</p></div></Link>
      <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">{links.map((link) => <NavLink key={link.label} end={link.to === '/'} to={link.to} className={({isActive}) => `text-sm font-semibold ${isActive ? 'text-[var(--primary)]' : 'text-[var(--muted)]'}`}>{link.label}</NavLink>)}</nav>
      {rightSlot ? <div className="hidden items-center gap-3 lg:flex">{rightSlot}</div> : null}
      <Button aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-navigation" className="!h-10 !w-10 !px-0 lg:!hidden" variant="secondary" onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}</Button>
      {open ? <nav id="mobile-navigation" aria-label="Mobile navigation" className="flex w-full flex-col gap-2 border-t pt-3 lg:hidden">{links.map((link) => <NavLink key={link.label} to={link.to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm font-semibold">{link.label}</NavLink>)}{rightSlot}</nav> : null}
    </div>
  </header>;
}
