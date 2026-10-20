import { ArrowRight, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { lazy, Suspense, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { weddingPhotos } from "../../assets/weddingVisuals";
import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
const QRScannerPanel = lazy(() => import("../../components/guest/QRScannerPanel"));
import { getEventByCode } from "../../services/eventService";
import { useAppState } from "../../store/AppStateContext";
import { formatDate, normaliseEventCode } from "../../utils/formatters";

function EventAccessPage() {
  const { eventCode } = useParams();
  const navigate = useNavigate();
  const { setGuestEvent } = useAppState();
  const [code, setCode] = useState(normaliseEventCode(eventCode || ""));
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [eventPreview, setEventPreview] = useState(null);

  const continueFlow = async () => {
    const cleaned = normaliseEventCode(code);

    if (!cleaned) {
      toast.error("Enter an event code or scan the QR first");
      return;
    }

    try {
      setIsChecking(true);
      const event = await getEventByCode(cleaned);
      setEventPreview(event);
      setGuestEvent({ eventCode: cleaned, event });
      toast.success(`Event code ${cleaned} verified`);
      navigate(`/upload-selfie/${cleaned}`);
    } catch (_error) {
      setEventPreview(null);
      toast.error("This event code was not found. Please check and try again.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <section className="page-shell">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="editorial-panel">
          <span className="pill">Guest access step 1</span>
          <h1 className="section-heading mt-6 max-w-3xl">
            Enter the event code and open your wedding gallery flow.
          </h1>
          <p className="subtle-copy mt-4 max-w-2xl">
            Guests only need one thing to begin: the event code shared by the photographer or the QR printed on the invitation, card, or standee.
          </p>

          <div className="mt-8 rounded-[30px] border border-[rgba(117,82,65,0.12)] bg-white/82 p-5 sm:p-6">
            <label className="field-label" htmlFor="event-code">
              Wedding event code
            </label>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
                <input
                  className="field-input min-h-[58px] pl-11 text-base"
                  id="event-code"
                  onChange={(currentEvent) => setCode(normaliseEventCode(currentEvent.target.value))}
                  placeholder="Type your code here, for example WED-3PPG"
                  value={code}
                />
              </div>

              <Button className="min-h-[58px] justify-center px-7 sm:min-w-[180px]" disabled={isChecking} onClick={continueFlow}>
                {isChecking ? "Checking..." : "Continue"}
                <ArrowRight className="ml-2" size={18} />
              </Button>
            </div>

            {isChecking ? (
              <div className="mt-4">
                <Loader label="Validating event code..." />
              </div>
            ) : null}

            {eventPreview ? (
              <div className="mt-5 rounded-[24px] border border-[rgba(117,82,65,0.12)] bg-[rgba(247,238,228,0.76)] p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Event found</p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">{eventPreview.event_name}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Event code {eventPreview.event_code} · {formatDate(eventPreview.event_date)}
                </p>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-dashed border-[rgba(117,82,65,0.16)] bg-[rgba(255,250,246,0.7)] p-5 text-sm leading-6 text-[var(--muted)]">
                After you enter the code, the wedding preview will appear here before the next step.
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.92fr]">
            <div className="rounded-[26px] border border-[rgba(117,82,65,0.1)] bg-[rgba(255,250,246,0.75)] p-5">
              <p className="text-lg font-semibold text-[var(--text)]">What guests need to do</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                <p>1. Enter the event code or scan the QR.</p>
                <p>2. Upload a clear selfie on the next screen.</p>
                <p>3. Open the personal gallery returned by AI search.</p>
              </div>
            </div>

            <div className="photo-frame min-h-[260px]">
              <img alt="Wedding couple preview" src={weddingPhotos.portrait} />
            </div>
          </div>
        </div>

        <Suspense fallback={<div className="editorial-panel self-start text-sm" role="status">Loading QR options...</div>}>
        <QRScannerPanel
          active={scannerOpen}
          onScan={(scannedCode) => {
            const cleaned = normaliseEventCode(scannedCode);
            setCode(cleaned);
            setScannerOpen(false);
            toast.success(`QR detected: ${cleaned}`);
          }}
          onToggle={() => setScannerOpen((current) => !current)}
        />
        </Suspense>
      </div>
    </section>
  );
}

export default EventAccessPage;
