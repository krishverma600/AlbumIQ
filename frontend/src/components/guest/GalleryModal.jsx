import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import DownloadButton from '../common/DownloadButton';

export default function GalleryModal({ item, onClose, onPrevious, onNext, position }) {
  const dialogRef = useRef(null);
  const actionsRef = useRef({ onClose, onPrevious, onNext });
  actionsRef.current = { onClose, onPrevious, onNext };
  useEffect(() => {
    if (!item) return;
    const previousFocus = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    const oldHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); actionsRef.current.onClose(); }
      if (event.key === 'ArrowLeft') actionsRef.current.onPrevious?.();
      if (event.key === 'ArrowRight') actionsRef.current.onNext?.();
      if (event.key === 'Tab') {
        const buttons = [...dialogRef.current.querySelectorAll('button:not(:disabled),a[href]')];
        if (!buttons.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = oldOverflow; document.documentElement.style.overflow = oldHtmlOverflow; document.removeEventListener('keydown', onKey); previousFocus?.focus(); };
  }, [Boolean(item)]);
  if (!item) return null;
  return createPortal(
    <div className="photo-lightbox" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Photo preview" className="photo-lightbox-dialog">
        <header className="flex min-w-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0"><h2 className="truncate text-base font-semibold">{item.title || 'Photo preview'}</h2>{position ? <p className="text-xs text-[var(--muted)]">{position}</p> : null}</div>
          <button type="button" aria-label="Close preview" className="icon-button shrink-0" onClick={onClose}><X size={22} /></button>
        </header>
        <div className="photo-lightbox-image">
          <img src={item.image} alt={item.title || 'Photo preview'} />
          {onPrevious ? <button aria-label="Previous photo" className="lightbox-arrow left-2" onClick={onPrevious}><ChevronLeft /></button> : null}
          {onNext ? <button aria-label="Next photo" className="lightbox-arrow right-2" onClick={onNext}><ChevronRight /></button> : null}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
          <p className="min-w-0 truncate text-sm text-[var(--muted)]">Full photo · Original resolution</p>
          <DownloadButton photo={item} variant="primary" className="shrink-0" />
        </footer>
      </div>
    </div>, document.body
  );
}
