import { CloudDownload } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

import Button from "../common/Button";
import { importDrivePhotos } from "../../services/photoService";

export default function DrivePhotoImport({ eventCode }) {
  const [links, setLinks] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const photoLinks = links.split(/\r?\n/).map((link) => link.trim()).filter(Boolean);

  async function handleImport(event) {
    event.preventDefault();
    if (!eventCode || !photoLinks.length || isImporting) return;
    if (photoLinks.length > 20) {
      toast.error("Import up to 20 photo links at a time.");
      return;
    }
    try {
      setIsImporting(true);
      const data = await importDrivePhotos({ eventCode, links: photoLinks });
      if (data.queued) {
        setLinks("");
        toast.success(`${data.queued} Drive photo(s) are being imported. Watch the upload queue for progress.`);
      }
      if (data.failed) toast.error(`${data.failed} import(s) could not start. Check the upload queue for details.`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.response?.data?.links?.[0] || "Unable to start the Drive import.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <form className="mt-8 rounded-[26px] border border-[rgba(124,61,143,0.16)] bg-white/85 p-5" onSubmit={handleImport}>
      <div className="flex items-center gap-3">
        <CloudDownload className="text-[var(--primary)]" size={24} />
        <h2 className="text-xl font-semibold text-[var(--text)]">Import from Google Drive</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        In Drive, share each photo with “Anyone with the link” and allow downloads. Paste one photo link per line, up to 20 at a time. Each photo can be up to 20 MB. Folder links are not supported.
      </p>
      <label className="field-label mt-5 block" htmlFor="drive-photo-links">Google Drive photo links</label>
      <textarea
        id="drive-photo-links"
        className="field-input mt-2 min-h-32 resize-y"
        placeholder="https://drive.google.com/file/d/.../view"
        value={links}
        onChange={(event) => setLinks(event.target.value)}
        disabled={isImporting}
      />
      <Button className="mt-4" disabled={!eventCode || !photoLinks.length || isImporting} type="submit">
        {isImporting ? "Starting import..." : `Import ${photoLinks.length || ""} photo${photoLinks.length === 1 ? "" : "s"} from Drive`}
      </Button>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {eventCode ? `Photos will be added to ${eventCode} and included in face search after processing.` : "Select a wedding before importing photos."}
      </p>
    </form>
  );
}
