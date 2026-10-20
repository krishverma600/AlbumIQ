import { ArrowRight, Camera, Shield } from "lucide-react";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Button from "../../components/common/Button";
import SelfieDropzone from "../../components/guest/SelfieDropzone";
import LiveSelfieCamera from "../../components/guest/LiveSelfieCamera";
import { getEventByCode } from "../../services/eventService";
import { useAppState } from "../../store/AppStateContext";
import { formatDate, normaliseEventCode } from "../../utils/formatters";
import { weddingPhotos } from "../../assets/weddingVisuals";

function SelfieUploadPage() {
  const { eventCode } = useParams();
  const navigate = useNavigate();
  const { guestFlow, guestSelfieFile, setGuestEvent, setGuestSelfie } = useAppState();
  const [preview, setPreview] = useState(guestFlow.selfiePreview);
  const [isLoadingEvent, setIsLoadingEvent] = useState(!guestFlow.event);
  const currentEventCode = normaliseEventCode(eventCode);

  useEffect(() => {
    let isMounted = true;

    async function ensureEvent() {
      if (guestFlow.event?.event_code === currentEventCode) {
        setIsLoadingEvent(false);
        return;
      }

      try {
        setIsLoadingEvent(true);
        const event = await getEventByCode(currentEventCode);
        if (isMounted) {
          setGuestEvent({ eventCode: currentEventCode, event });
        }
      } catch (_error) {
        if (isMounted) {
          toast.error("Please validate the event code before uploading a selfie.");
          navigate(`/event/${currentEventCode}`);
        }
      } finally {
        if (isMounted) {
          setIsLoadingEvent(false);
        }
      }
    }

    ensureEvent();
    return () => {
      isMounted = false;
    };
  }, [currentEventCode, guestFlow.event, navigate, setGuestEvent]);

  const handleFileSelected = (file) => {
    const nextPreview = URL.createObjectURL(file);
    setPreview(nextPreview);
    setGuestSelfie({ selfieName: file.name, selfiePreview: nextPreview, selfieFile: file });
    toast.success("Selfie added. You can continue to the gallery.");
  };

  return (
    <section className="page-shell">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_0.95fr]">
        <div className="editorial-panel">
          <p className="pill">Guest access step 2</p>
          <h1 className="section-heading mt-6">Upload a selfie so the AI can find your best wedding moments.</h1>
          <p className="subtle-copy mt-4 max-w-2xl">
            Event code <span className="font-bold text-[var(--primary)]">{currentEventCode}</span> is active.
            Use a clear selfie for better recognition and faster results.
          </p>

          {guestFlow.event ? (
            <div className="mt-6 rounded-[24px] border border-[rgba(117,82,65,0.12)] bg-white/80 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Validated event</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text)]">{guestFlow.event.event_name}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{formatDate(guestFlow.event.event_date)}</p>
            </div>
          ) : null}

          <div className="mt-8">
            <LiveSelfieCamera onFileSelected={handleFileSelected} />
            <SelfieDropzone onFileSelected={handleFileSelected} capture={false} title="Or upload a reference photo" description="Choose a clear photo containing only the person you want to find in this event's album." />
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-[26px] border border-[rgba(117,82,65,0.12)] bg-white/75 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Shield className="mt-1 text-[var(--primary)]" size={18} />
              <div>
                <p className="font-semibold text-[var(--text)]">Privacy-first guest flow</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                  Your selfie is used only for this event search flow and can later be deleted by policy.
                </p>
              </div>
            </div>
            <Link to={`/event/${currentEventCode}`}>
              <Button variant="ghost">Change event code</Button>
            </Link>
          </div>
        </div>

        <div className="editorial-panel">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(124,61,143,0.1)] text-[var(--primary)]">
              <Camera size={20} />
            </div>
            <div>
              <p className="text-lg font-semibold text-[var(--text)]">Selfie preview</p>
              <p className="text-sm text-[var(--muted)]">Use phone camera capture or upload from gallery.</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[28px] border border-[rgba(117,82,65,0.12)] bg-[rgba(140,79,65,0.04)]">
            {preview ? (
              <img alt="Guest selfie preview" className="h-[380px] w-full object-cover" src={preview} />
            ) : (
              <div className="grid h-[380px] grid-cols-[0.95fr_1.05fr]">
                <img alt="Wedding example gallery mood" className="h-full w-full object-cover" src={weddingPhotos.ceremony} />
                <div className="flex items-center justify-center px-6 text-center text-sm leading-7 text-[var(--muted)]">
                  Once a selfie is selected, it will appear here with a quick review before the AI search begins.
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-[24px] border border-[rgba(117,82,65,0.12)] bg-white/85 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">Ready for AI match</p>
            <h3 className="mt-3 text-2xl font-semibold text-[var(--text)]">
              {guestSelfieFile ? "Your reference photo is selected" : "No selfie selected yet"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              We compare your face with the faces in every processed photo of this event. The filename does not affect matching.
            </p>
            <Button
              className="mt-6 w-full"
              disabled={!guestSelfieFile || isLoadingEvent}
              onClick={() => {
                if (!preview) {
                  toast.error("Please upload a selfie first");
                  return;
                }

                navigate(`/gallery/${currentEventCode}`);
              }}
            >
              {isLoadingEvent ? "Loading event..." : "Find my photos"}
              <ArrowRight className="ml-2" size={18} />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SelfieUploadPage;
