import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import Button from "../common/Button";

export default function LiveSelfieCamera({ onFileSelected }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const aliveRef = useRef(true);
  const openingRef = useRef(false);

  function stopCamera() {
    openingRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsOpen(false);
    setIsStarting(false);
  }

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      openingRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (isOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => setError("Could not start the preview. Close the camera and try again."));
    }
  }, [isOpen]);

  async function openCamera() {
    if (openingRef.current || isOpen) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires HTTPS or localhost. You can also upload a photo below.");
      return;
    }
    openingRef.current = true;
    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false
      });
      if (!aliveRef.current || !openingRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setIsOpen(true);
    } catch (error) {
      if (aliveRef.current) setError(error.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser or upload a photo below."
        : "Could not access your camera. Check that it is connected and available, or upload a photo below.");
    } finally {
      openingRef.current = false;
      if (aliveRef.current) setIsStarting(false);
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setError("Wait for the camera preview before taking your photo.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!aliveRef.current) return;
      if (!blob) { setError("Could not capture the photo. Please try again."); return; }
      onFileSelected(new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" }));
      stopCamera();
    }, "image/jpeg", 0.95);
  }

  return (
    <div className="mb-5 rounded-[24px] border border-[rgba(117,82,65,0.16)] bg-white/85 p-5">
      <h3 className="text-xl font-semibold text-[var(--text)]">Take a live selfie</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Face the camera in good light with only your face in view.</p>
      {isOpen ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted aria-label="Live selfie camera preview" className="mt-4 w-full rounded-[20px]" style={{ transform: "scaleX(-1)" }} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={capturePhoto}>Take photo</Button>
            <Button variant="secondary" onClick={stopCamera}>Close camera</Button>
          </div>
        </>
      ) : <Button className="mt-4" onClick={openCamera} disabled={isStarting}><Camera className="mr-2" size={18} />{isStarting ? "Opening camera..." : "Open camera"}</Button>}
      {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
