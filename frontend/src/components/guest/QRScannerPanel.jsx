import { Camera, ImageUp, QrCode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from '../common/Button';
import { decodeQrPixels, eventCodeFromQr, readQrFile } from '../../utils/qr';

export default function QRScannerPanel({ active, onScan, onToggle }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const callbackRef = useRef(onScan);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [success, setSuccess] = useState('');
  callbackRef.current = onScan;

  useEffect(() => {
    if (!active) return;
    let stopped = false, stream, timer;
    setError(''); setSuccess(''); setStarting(true);
    const canvas = document.createElement('canvas');
    const stop = () => { stopped = true; window.clearTimeout(timer); stream?.getTracks().forEach((track) => track.stop()); };
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs HTTPS or localhost. You can upload a QR image instead.');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        if (stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (stopped) return;
        setStarting(false);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('QR camera scanning is unavailable. Upload a QR image instead.');
        function scan() {
          if (stopped) return;
          const video = videoRef.current;
          if (video?.videoWidth && video.readyState >= 2) {
            const scale = Math.min(1, 900 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const result = decodeQrPixels(image.data, image.width, image.height);
            if (result) {
              try { const code = eventCodeFromQr(result); stop(); setSuccess(`Event code ${code} found. Select Continue to open the event.`); callbackRef.current(code); return; }
              catch (error) { setError(error.message); }
            }
          }
          timer = window.setTimeout(scan, 250);
        }
        scan();
      } catch (error) {
        stream?.getTracks().forEach((track) => track.stop());
        if (!stopped) { setStarting(false); setError(error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow access in your browser or upload a QR image.' : error.message || 'Camera unavailable. Upload a QR image instead.'); }
      }
    }
    start();
    return stop;
  }, [active]);

  async function uploadQr(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (active) onToggle();
    setReading(true); setError(''); setSuccess('');
    try { const code = await readQrFile(file); setSuccess(`Event code ${code} found. Select Continue to open the event.`); onScan(code); }
    catch (error) { setError(error.message || 'Could not read this QR image. Please choose another.'); }
    finally { setReading(false); }
  }
  return <div className="editorial-panel self-start">
    <div className="flex items-start gap-3"><QrCode size={28} className="shrink-0 text-[var(--primary)]" /><div><h2 className="text-xl font-semibold">Open your event with a QR</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Scan the QR shared by your photographer, or upload a saved QR image or screenshot.</p></div></div>
    <div className="mt-5 flex flex-wrap gap-3"><Button onClick={onToggle} disabled={reading}><Camera className="mr-2" size={18} />{active ? 'Close camera' : 'Scan with camera'}</Button><Button variant="secondary" disabled={reading} onClick={() => fileRef.current?.click()}><ImageUp className="mr-2" size={18} />{reading ? 'Reading QR...' : 'Upload QR image'}</Button></div>
    <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Upload an event QR image" onChange={uploadQr} />
    {active ? <div className="relative mt-5 overflow-hidden rounded-2xl bg-black"><video ref={videoRef} autoPlay playsInline muted aria-label="QR camera preview" className="max-h-72 w-full object-contain" />{starting ? <p className="absolute inset-0 flex items-center justify-center bg-black/40 p-4 text-sm text-white">Opening camera...</p> : null}<p className="p-3 text-center text-xs text-white">Keep the full QR code inside the camera view.</p></div> : null}
    {success ? <p className="mt-4 text-sm text-green-800" role="status">{success}</p> : null}
    {error ? <p className="mt-4 text-sm text-red-700" role="alert">{error}</p> : null}
  </div>;
}
