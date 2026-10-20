import { Download } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Button from './Button';
import { downloadPhoto } from '../../utils/downloads';

export default function DownloadButton({ photo, className = '', variant = 'secondary' }) {
  const [busy, setBusy] = useState(false);
  return <Button className={className} variant={variant} disabled={busy || !photo.image} onClick={async () => {
    if (busy) return;
    try { setBusy(true); await downloadPhoto(photo); }
    catch (error) { toast.error(error.message || 'Download failed. Please try again.'); }
    finally { setBusy(false); }
  }}><Download size={16} className="mr-2 shrink-0" />{busy ? 'Downloading...' : 'Download'}</Button>;
}
