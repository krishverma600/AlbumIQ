import { ArrowLeft, Download, Images, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Button from "../../components/common/Button";
import Loader from "../../components/common/Loader";
import GalleryModal from "../../components/guest/GalleryModal";
import { searchPhotos } from "../../services/searchService";
import { useAppState } from "../../store/AppStateContext";
import { weddingPhotos } from "../../assets/weddingVisuals";

function GalleryPage() {
  const { eventCode } = useParams();
  const navigate = useNavigate();
  const { guestFlow, guestSelfieFile, setGuestResults } = useAppState();
  const [selectedImage, setSelectedImage] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchedRequestRef = useRef("");
  const code = eventCode?.toUpperCase();

  const searchRequestKey = guestSelfieFile
    ? `${code}:${guestSelfieFile.name}:${guestSelfieFile.size}:${guestSelfieFile.lastModified}`
    : "";

  useEffect(() => {
    async function runSearch() {
      if (!guestSelfieFile || searchedRequestRef.current === searchRequestKey) {
        return;
      }

      searchedRequestRef.current = searchRequestKey;

      try {
        setIsSearching(true);
        const data = await searchPhotos({ eventCode: code, selfie: guestSelfieFile });

        const matches = data.matched_images.map((item, index) => ({
          id: item.photo_id,
          image: item.image_url,
          title: `Matched photo ${index + 1}`,
          time: "Matched by AI",
          score: `${Number(item.similarity || 0).toFixed(2)}%`,
          similarity: item.similarity
        }));

        setGuestResults({
          matches,
          matchedCount: data.matched_count,
          searchId: data.search_id,
          searchError: ""
        });

        if (!matches.length) {
          toast.success("Search completed. No matching photos were found yet.");
        }
      } catch (error) {
        const detail =
          error?.response?.data?.detail ||
          "Guest search could not complete right now.";

        setGuestResults({
          matches: [],
          matchedCount: 0,
          searchId: "",
          searchError: detail
        });
        toast.error(detail);
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    }

    if (
      !guestFlow.matches.length &&
      guestSelfieFile &&
      searchedRequestRef.current !== searchRequestKey
    ) {
      runSearch();
    }

  }, [code, guestFlow.matches.length, guestSelfieFile, searchRequestKey, setGuestResults]);

  const matches = useMemo(() => guestFlow.matches || [], [guestFlow.matches]);
  const canRetry = Boolean(guestSelfieFile);

  return (
    <section className="page-shell">
      <div className="mx-auto max-w-7xl">
        <div className="glass-panel">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="pill">Guest access step 3</p>
              <h1 className="section-heading mt-6">Your personalized photo gallery is ready.</h1>
              <p className="subtle-copy mt-4 max-w-2xl">
                This page now uses the real backend search API for event code{" "}
                <span className="font-bold text-[var(--primary)]">{code}</span>.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-full border border-[rgba(124,61,143,0.12)] bg-white/85 px-4 py-3 text-sm font-semibold text-[var(--text)]">
                {guestFlow.matchedCount || matches.length} matches found
              </div>
              <Link to={`/upload-selfie/${code}`}>
                <Button variant="secondary">
                  <ArrowLeft className="mr-2" size={18} />
                  Change selfie
                </Button>
              </Link>
            </div>
          </div>

          {isSearching ? (
            <div className="mt-8 rounded-[24px] border border-[rgba(124,61,143,0.12)] bg-white/85 p-6">
              <Loader label="Searching event photos with the backend AI workflow..." />
            </div>
          ) : null}

          {!guestSelfieFile && !matches.length ? (
            <div className="mt-8 rounded-[24px] border border-dashed border-[rgba(124,61,143,0.16)] bg-white/80 p-6 text-sm leading-6 text-[var(--muted)]">
              A guest selfie is required to run search. Go back to the upload step and choose a selfie first.
            </div>
          ) : null}

          {guestFlow.searchError ? (
            <div className="mt-8 rounded-[24px] border border-[rgba(240,93,151,0.24)] bg-[rgba(255,236,245,0.85)] p-6">
              <p className="text-lg font-semibold text-[var(--text)]">Search could not complete</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{guestFlow.searchError}</p>
              {canRetry ? (
                <Button
                  className="mt-5"
                  onClick={async () => {
                    try {
                      searchedRequestRef.current = "";
                      setIsSearching(true);
                      const data = await searchPhotos({ eventCode: code, selfie: guestSelfieFile });
                      const nextMatches = data.matched_images.map((item, index) => ({
                        id: item.photo_id,
                        image: item.image_url,
                        title: `Matched photo ${index + 1}`,
                        time: "Matched by AI",
                        score: `${Number(item.similarity || 0).toFixed(2)}%`,
                        similarity: item.similarity
                      }));
                      setGuestResults({
                        matches: nextMatches,
                        matchedCount: data.matched_count,
                        searchId: data.search_id,
                        searchError: ""
                      });
                      toast.success("Search retried successfully");
                    } catch (error) {
                      const detail = error?.response?.data?.detail || "Search retry failed.";
                      setGuestResults({
                        matches: [],
                        matchedCount: 0,
                        searchId: "",
                        searchError: detail
                      });
                      toast.error(detail);
                    } finally {
                      setIsSearching(false);
                    }
                  }}
                >
                  <RefreshCcw className="mr-2" size={18} />
                  Retry search
                </Button>
              ) : null}
            </div>
          ) : null}

          {!isSearching && !guestFlow.searchError && !matches.length && guestSelfieFile ? (
            <div className="mt-8 grid gap-0 overflow-hidden rounded-[28px] border border-dashed border-[rgba(117,82,65,0.16)] bg-white/80 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="p-6 text-sm leading-7 text-[var(--muted)]">
                <p className="text-lg font-semibold text-[var(--text)]">No matches yet for this selfie.</p>
                <p className="mt-3">
                  That usually means either the event album is still being uploaded, the face embeddings are still processing, or this selfie does not closely match the uploaded wedding photos yet.
                </p>
                <p className="mt-3">
                  You can retry later or go back and choose another selfie with a clearer front-facing angle.
                </p>
              </div>
              <img alt="Wedding gallery atmosphere" className="h-full min-h-[240px] w-full object-cover" src={weddingPhotos.editorial} />
            </div>
          ) : null}

          {matches.length ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {matches.map((item) => (
                <article
                  key={item.id}
                  className="group overflow-hidden rounded-[28px] border border-[rgba(124,61,143,0.12)] bg-white shadow-[0_22px_55px_rgba(93,62,109,0.10)]"
                >
                  <img alt={item.title} className="h-72 w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={item.image} />
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-semibold text-[var(--text)]">{item.title}</h3>
                      <span className="rounded-full bg-[rgba(124,61,143,0.08)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                        {item.score}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">Returned by backend event search</p>
                    <div className="mt-5 flex gap-3">
                      <Button className="flex-1" onClick={() => setSelectedImage(item)}>
                        <Images className="mr-2" size={18} />
                        Preview
                      </Button>
                      <a
                        className="inline-flex flex-1 items-center justify-center rounded-full border border-[rgba(124,61,143,0.14)] px-4 py-3 text-sm font-semibold text-[var(--text)]"
                        download
                        href={item.image}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Download className="mr-2" size={18} />
                        Save
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <GalleryModal item={selectedImage} onClose={() => setSelectedImage(null)} />
    </section>
  );
}

export default GalleryPage;
