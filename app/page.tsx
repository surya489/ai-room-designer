
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Image from "next/image";

type DesignResult = {
  result?: string;
  error?: string;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function Home() {
  const [roomType, setRoomType] = useState("Bedroom");
  const [style, setStyle] = useState("Modern Minimal");
  const [budget, setBudget] = useState("₹20,000");
  const [requirements, setRequirements] = useState(
    "Warm lighting, walnut furniture, and a relaxing atmosphere"
  );

  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );

  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Stop the camera and release its resources.
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStream(null);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraOpen(false);
    setCameraLoading(false);
  }, []);

  // Connect the media stream to the video element as soon as it mounts.
  useEffect(() => {
    if (cameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current
        .play()
        .catch((err) => console.log("Video playback interrupted:", err));
    }
  }, [cameraOpen, cameraStream]);

  // Release the camera when leaving the page.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Release old preview URLs when they are replaced.
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  async function openCamera(
    mode: "environment" | "user" = facingMode
  ) {
    setError("");
    setCameraLoading(true);

    // Stop any existing tracks before opening/switching camera
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera access is unavailable. Open this website using HTTPS or localhost."
        );
      }

      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (firstError) {
        if (
          firstError instanceof Error &&
          firstError.name !== "OverconstrainedError" &&
          firstError.name !== "NotFoundError"
        ) {
          throw firstError;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }

      streamRef.current = stream;
      setCameraStream(stream);
      setFacingMode(mode);
      setCameraOpen(true);
    } catch (err) {
      const cameraError = err as { name?: string; message?: string };

      if (cameraError.name === "NotAllowedError") {
        setError(
          "Camera permission was denied. Allow camera access in your browser settings and try again."
        );
      } else if (cameraError.name === "NotFoundError") {
        setError("No available camera was found on this device.");
      } else if (cameraError.name === "NotReadableError") {
        setError(
          "The camera may be in use by another application. Close it and try again."
        );
      } else {
        setError(
          cameraError.message ||
          "Unable to open the camera. Please try uploading a photo."
        );
      }

      stopCamera();
    } finally {
      setCameraLoading(false);
    }
  }


  function selectImage(file: File | null) {
    if (!file) return;

    setError("");
    setResult("");

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please select a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Image size must be 5 MB or less.");
      return;
    }

    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    stopCamera();
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    console.log("video", video);

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setError("The camera is not ready. Please wait and try again.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Unable to capture the photo. Please try again.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Unable to capture the photo. Please try again.");
          return;
        }

        const file = new File([blob], `room-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        if (file.size > MAX_IMAGE_SIZE) {
          setError(
            "The captured photo exceeds 5 MB. Please use a lower-resolution camera setting or upload a smaller image."
          );
          return;
        }

        setImage(file);
        setImagePreview(URL.createObjectURL(file));
        setError("");
        setResult("");
        stopCamera();
      },
      "image/jpeg",
      0.85
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!image) {
      setError("Please capture or upload a room photo first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");

    try {
      const formData = new FormData();

      formData.append("roomType", roomType);
      formData.append("style", style);
      formData.append("budget", budget);
      formData.append("requirements", requirements);
      formData.append("image", image);

      const response = await fetch("/api/designUsingGemini", {
        method: "POST",
        body: formData,
      });

      const data: DesignResult = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to analyze your room."
        );
      }

      setResult(data.result || "No result was returned.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to Gemini."
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(result);
    } catch {
      setError("Unable to copy the recommendations.");
    }
  }

  return (
    <main className="min-h-screen bg-[#101010] text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          room<span className="text-violet-400">craft.</span>
        </Link>

        <span className="rounded-full border border-white/10 px-4 py-2 text-xs text-gray-300">
          AI INTERIOR DESIGNER
        </span>
      </nav>

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-12 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm text-violet-300">
            ✦ Your personal AI design assistant
          </span>

          <h1 className="mt-7 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Your dream room,
            <span className="block text-violet-400">
              designed by AI.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-gray-400">
            Capture your room directly with your camera or upload a
            photo. Get personalized interior design recommendations.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/10 bg-[#191919] p-6 sm:p-8"
          >
            <h2 className="text-xl font-semibold">Design your space</h2>
            <p className="mt-2 text-sm text-gray-400">
              Capture a photo and customize your preferences.
            </p>

            <div className="mt-7 space-y-5">
              {/* Camera and photo preview */}
              <div>
                <div className="mb-2 block text-sm text-gray-300">
                  Your room photo
                </div>

                {cameraOpen ? (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="aspect-[4/3] w-full object-contain"
                    />

                    <div className="flex flex-wrap gap-2 p-3">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="flex-1 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold hover:bg-violet-400"
                      >
                        Capture Photo
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openCamera(
                            facingMode === "environment"
                              ? "user"
                              : "environment"
                          )
                        }
                        className="rounded-xl border border-white/15 px-3 py-3 text-sm hover:bg-white/5"
                        aria-label="Switch camera"
                        title="Switch camera"
                      >
                        <span aria-hidden="true">🔄</span>
                      </button>

                      <button
                        type="button"
                        onClick={stopCamera}
                        className="rounded-xl border border-white/15 px-3 py-3 text-sm hover:bg-white/5"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : imagePreview ? (
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#222222] p-3">
                    <Image
                      src={imagePreview}
                      alt="Preview of your room"
                      className="max-h-72 w-full rounded-xl object-contain"
                      width={500}
                      height={500}
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openCamera()}
                        disabled={loading || cameraLoading}
                        className="flex-1 rounded-xl border border-white/15 px-3 py-3 text-sm hover:bg-white/5 disabled:opacity-50"
                      >
                        Retake photo
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                        className="flex-1 rounded-xl border border-white/15 px-3 py-3 text-sm hover:bg-white/5 disabled:opacity-50"
                      >
                        Choose another
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setImage(null);
                          setImagePreview("");
                          setResult("");
                          setError("");
                        }}
                        disabled={loading}
                        className="rounded-xl border border-red-400/20 px-3 py-3 text-sm text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-[#222222] p-5 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-400/10 text-3xl">
                      📸
                    </div>

                    <p className="mt-3 text-sm font-medium">
                      Capture your room
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      Use your webcam or phone camera.
                    </p>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => openCamera()}
                        disabled={loading || cameraLoading}
                        className="rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold hover:bg-violet-400 disabled:opacity-50"
                      >
                        {cameraLoading ? "Opening camera..." : "Open Camera"}
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading}
                        className="rounded-xl border border-white/15 px-4 py-3 text-sm hover:bg-white/5 disabled:opacity-50"
                      >
                        Upload Photo
                      </button>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    selectImage(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                  className="hidden"
                  disabled={loading}
                />

                <canvas ref={canvasRef} className="hidden" />

                <p className="mt-2 text-xs text-gray-500">
                  JPG, PNG or WebP · Maximum 5 MB
                </p>
              </div>

              {/* Room type */}
              <div>
                <label
                  htmlFor="roomType"
                  className="mb-2 block text-sm text-gray-300"
                >
                  Room type
                </label>

                <select
                  id="roomType"
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#222222] px-4 py-3 outline-none focus:border-violet-400"
                >
                  <option>Bedroom</option>
                  <option>Living Room</option>
                  <option>Home Office</option>
                  <option>Studio Apartment</option>
                </select>
              </div>

              {/* Design style */}
              <div>
                <label
                  htmlFor="style"
                  className="mb-2 block text-sm text-gray-300"
                >
                  Design style
                </label>

                <select
                  id="style"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#222222] px-4 py-3 outline-none focus:border-violet-400"
                >
                  <option>Modern Minimal</option>
                  <option>Scandinavian</option>
                  <option>Industrial</option>
                  <option>Luxury Contemporary</option>
                  <option>Warm and Cozy</option>
                </select>
              </div>

              {/* Budget */}
              <div>
                <label
                  htmlFor="budget"
                  className="mb-2 block text-sm text-gray-300"
                >
                  Budget
                </label>

                <select
                  id="budget"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#222222] px-4 py-3 outline-none focus:border-violet-400"
                >
                  <option>₹5,000</option>
                  <option>₹10,000</option>
                  <option>₹20,000</option>
                  <option>₹50,000</option>
                  <option>₹1,00,000+</option>
                </select>
              </div>

              {/* Additional requirements */}
              <div>
                <label
                  htmlFor="requirements"
                  className="mb-2 block text-sm text-gray-300"
                >
                  What are you looking for?
                </label>

                <textarea
                  id="requirements"
                  rows={4}
                  maxLength={500}
                  required
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Describe your room and preferences..."
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#222222] px-4 py-3 outline-none placeholder:text-gray-600 focus:border-violet-400"
                />

                <p className="mt-1 text-right text-xs text-gray-500">
                  {requirements.length}/500
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || cameraOpen || cameraLoading}
                className="w-full rounded-xl bg-violet-500 px-5 py-4 font-semibold transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Analyzing your room..."
                  : "✦ Analyze My Room"}
              </button>
            </div>
          </form>

          {/* Results panel */}
          <section
            aria-live="polite"
            className="min-h-[400px] rounded-3xl border border-white/10 bg-[#191919] p-6 sm:p-8"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                Your design ideas
              </h2>

              <span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs text-violet-300">
                Gemini AI
              </span>
            </div>

            {!result && !loading && !error && (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-400/10 text-3xl">
                  ✧
                </div>

                <h3 className="mt-5 text-lg font-medium">
                  Your inspiration starts here
                </h3>

                <p className="mt-2 max-w-xs text-sm leading-6 text-gray-400">
                  Capture or upload a room photo to receive
                  personalized design recommendations.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-400/20 border-t-violet-400" />

                <p className="mt-5 text-gray-300">
                  Gemini is analyzing your room...
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  This may take a few seconds.
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            {result && !loading && (
              <div className="mt-6">
                <div className="mb-5 rounded-xl bg-violet-400/10 p-4">
                  <p className="text-sm font-medium text-violet-300">
                    Your room analysis is ready
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Recommendations based on your photo and preferences.
                  </p>
                </div>

                <div className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-300">
                  {result}
                </div>

                <button
                  type="button"
                  onClick={copyResult}
                  className="mt-6 rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:bg-white/5"
                >
                  Copy recommendations
                </button>
              </div>
            )}
          </section>
        </div>

        <p className="mt-8 text-center text-xs text-gray-500">
          Your selected photo is sent to Gemini for analysis.
          This application does not permanently store it.
        </p>
      </section>
    </main>
  );
}
