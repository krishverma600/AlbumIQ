import { Copy, QrCode } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";

import Button from "../../components/common/Button";
import DownloadButton from "../../components/common/DownloadButton";
import { createEvent } from "../../services/eventService";
import { useAppState } from "../../store/AppStateContext";
import { formatDate } from "../../utils/formatters";

function CreateEventPage() {
  const { setSelectedAdminEventId } = useAppState();
  const [form, setForm] = useState({
    coupleName: "",
    date: "",
    venue: "",
    welcomeMessage: "Scan to find your photos instantly"
  });
  const [createdEvent, setCreatedEvent] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const shareableEvent = createdEvent || null;

  const copyEventCode = async () => {
    if (!shareableEvent?.event_code) {
      toast.error("Create an event first to copy the code.");
      return;
    }

    try { await navigator.clipboard.writeText(shareableEvent.event_code); toast.success(`Copied ${shareableEvent.event_code}`); }
    catch { toast.error("Could not copy. Please copy the event code manually."); }
  };

  return (
    <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="glass-panel">
        <p className="pill">Create wedding</p>
        <h1 className="mt-4 text-3xl font-semibold text-[var(--text)]">Create an event for your guests.</h1>

        <form
          className="mt-8 grid gap-5 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();

            try {
              setIsSaving(true);
              const payload = await createEvent({
                event_name: form.coupleName,
                event_date: form.date || null,
                venue: form.venue,
                welcome_message: form.welcomeMessage
              });
              setCreatedEvent(payload);
              setSelectedAdminEventId(payload.id);
              if (payload.sms_notification?.sent) {
                toast.success(`Event ${payload.event_code} created and SMS sent`);
              } else {
                toast.success(`Event ${payload.event_code} created successfully`);

              }
            } catch (error) {
              const detail =
                error?.response?.data?.detail ||
                error?.response?.data?.event_name?.[0] ||
                "Unable to create the event right now.";
              toast.error(detail);
            } finally {
              setIsSaving(false);
            }
          }}
        >
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="couple-name">
              Couple or event title
            </label>
            <input
              className="field-input mt-2"
              id="couple-name"
              required
              placeholder="e.g. Aarav & Siya’s wedding"
              onChange={(event) => setForm((current) => ({ ...current, coupleName: event.target.value }))}
              value={form.coupleName}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="event-date">
              Event date
            </label>
            <input
              className="field-input mt-2"
              id="event-date"
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              type="date"
              value={form.date}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="event-venue">
              Venue
            </label>
            <input
              className="field-input mt-2"
              id="event-venue"
              placeholder="Venue (optional)"
              onChange={(event) => setForm((current) => ({ ...current, venue: event.target.value }))}
              value={form.venue}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="event-message">
              Guest welcome message
            </label>
            <textarea
              className="field-input mt-2 min-h-28 resize-none"
              id="event-message"
              onChange={(event) => setForm((current) => ({ ...current, welcomeMessage: event.target.value }))}
              value={form.welcomeMessage}
            />
          </div>

          <div className="sm:col-span-2">
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Creating event..." : "Create event"}
            </Button>
          </div>
        </form>
      </div>

      <div className="glass-panel">
        <p className="pill">Guest preview</p>
        <h2 className="mt-4 text-2xl font-semibold text-[var(--text)]">{form.coupleName || "Your event name"}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {form.venue || "Your venue"} · {formatDate(form.date)}
        </p>

        <div className="mt-8 rounded-[28px] bg-[linear-gradient(135deg,#7c3d8f,#f05d97)] p-6 text-white shadow-[0_24px_55px_rgba(124,61,143,0.28)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-white/80">Event code</p>
              <p className="mt-3 text-3xl font-bold">{shareableEvent?.event_code || "Generated after save"}</p>
            </div>
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[24px] bg-white text-[var(--primary)]">
              {shareableEvent?.qr_url ? (
                <img
                  alt={`${shareableEvent.event_code} QR code`}
                  className="h-full w-full object-cover"
                  src={shareableEvent.qr_url}
                />
              ) : (
                <QrCode size={40} />
              )}
            </div>
          </div>
          <p className="mt-6 text-sm leading-6 text-white/85">{form.welcomeMessage}</p>
          {shareableEvent?.guest_portal_url ? (
            <p className="mt-4 break-all text-sm leading-6 text-white/85">
              Guest page: {shareableEvent.guest_portal_url}
            </p>
          ) : null}
          {shareableEvent?.sms_notification ? (
            <p className="mt-3 text-sm leading-6 text-white/85">
              {shareableEvent.sms_notification.sent ? "Your event details have been sent to your phone." : "You can share this event using its code, link, or QR."}
            </p>
          ) : null}
          {shareableEvent ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button className="bg-white text-[var(--primary)] hover:bg-white/90" onClick={copyEventCode} type="button">
                <Copy className="mr-2" size={16} />
                Copy event code
              </Button>
              {shareableEvent.qr_url ? (
                <DownloadButton variant="secondary" photo={{ image: shareableEvent.qr_url, filename: `${shareableEvent.event_code}-QR.png` }} />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border bg-white/85 p-5 text-sm leading-6 text-[var(--muted)]">
          <p className="font-semibold text-[var(--text)]">Ready to invite your guests?</p>
          <p className="mt-2">Create your event, upload your photos, and share the event code or QR. Guests can then find and download their photos with a selfie.</p>
        </div>
      </div>
    </section>
  );
}

export default CreateEventPage;
