
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

type RoomPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const BUDGET_MIN = 5000;
const BUDGET_MAX = 200000;
const ROOM_OPTIONS = ["Bedroom", "Living room", "Kitchen", "Study"];
const STYLE_OPTIONS = [
  "Modern minimal",
  "Japandi",
  "Scandinavian",
  "Warm industrial",
];

function formatIndianCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Home() {
  const [roomType, setRoomType] = useState("Bedroom");
  const [style, setStyle] = useState("Modern minimal");
  const [budget, setBudget] = useState(20000);
  const [budgetInput, setBudgetInput] = useState("20000");
  const [requirements, setRequirements] = useState(
    "Warm lighting, walnut furniture, and a relaxing atmosphere"
  );

  const [photos, setPhotos] = useState<RoomPhoto[]>([]);
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
  const photosRef = useRef(photos);

  const sliderProgress = ((budget - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100;

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

  useEffect(() => {
    if (cameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current
        .play()
        .catch((err) => console.log("Video playback interrupted:", err));
    }
  }, [cameraOpen, cameraStream]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  async function openCamera(mode: "environment" | "user" = facingMode) {
    setError("");
    setCameraLoading(true);

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

  function selectImages(selectedFiles: FileList | null) {
    if (!selectedFiles?.length) return;

    const files = Array.from(selectedFiles);

    if (photos.length + files.length > MAX_IMAGES) {
      setError(`You can add up to ${MAX_IMAGES} room photos.`);
      return;
    }

    const invalidType = files.find((file) => !ALLOWED_TYPES.includes(file.type));
    if (invalidType) {
      setError("Please select JPG, PNG, or WebP images only.");
      return;
    }

    if (files.some((file) => file.size > MAX_IMAGE_SIZE)) {
      setError("Each image must be 5 MB or less.");
      return;
    }

    const addedPhotos = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      return { id: previewUrl, file, previewUrl };
    });

    setPhotos((currentPhotos) => [...currentPhotos, ...addedPhotos]);
    setError("");
    setResult("");
    stopCamera();
  }

  function removePhoto(photoId: string) {
    const photo = photos.find(({ id }) => id === photoId);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPhotos((currentPhotos) =>
      currentPhotos.filter(({ id }) => id !== photoId)
    );
    setResult("");
    setError("");
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

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

        if (photos.length >= MAX_IMAGES) {
          setError(`You can add up to ${MAX_IMAGES} room photos.`);
          return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
          setError(
            "The captured photo exceeds 5 MB. Please use a lower-resolution camera setting or upload a smaller image."
          );
          return;
        }

        const previewUrl = URL.createObjectURL(file);
        setPhotos((currentPhotos) => [
          ...currentPhotos,
          { id: previewUrl, file, previewUrl },
        ]);
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

    if (!photos.length) {
      setError("Please capture or upload at least one room photo first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");

    try {
      const formData = new FormData();

      formData.append("roomType", roomType);
      formData.append("style", style);
      formData.append("budget", formatIndianCurrency(budget));
      formData.append("requirements", requirements);
      photos.forEach(({ file }) => formData.append("image", file));

      const response = await fetch("/api/designUsingGemini", {
        method: "POST",
        body: formData,
      });

      const data: DesignResult = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to analyze your room.");
      }

      setResult(data.result || "No result was returned.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to connect to Gemini."
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
    <main className="min-h-screen bg-[#0d0d0b] text-[#f2eee7]">
      <div className="mx-auto max-w-[1460px] px-4 pb-10 pt-6 sm:px-6 lg:px-10">
        <header className="flex items-center justify-between gap-4 py-2">
          <Link
            href="/"
            className="text-2xl font-medium tracking-[-0.06em] text-[#f2eee7]"
            aria-label="Roomcraft home"
          >
            room<span className="text-[#e8b777]">craft.</span>
          </Link>

          <nav className="flex items-center gap-3 text-xs text-[#a49d91] sm:gap-5 sm:text-sm">
            <Link href="/page-1" className="transition hover:text-[#f2eee7]">
              Page 1
            </Link>
            <Link href="/page-2" className="transition hover:text-[#f2eee7]">
              Page 2
            </Link>
            <div className="hidden rounded-full border border-[#302e29] bg-[#151513] px-4 py-2 text-[#d8d0c2] sm:block">
              Powered by Gemini
            </div>
          </nav>
        </header>

        <section className="pt-8 md:pt-10 lg:pt-14">
          <div className="animate-rise mb-8 flex items-center justify-center md:justify-start">
            <div className="flex h-full w-full max-w-[420px] flex-col gap-3 lg:max-w-[760px]">
              <h1 className="max-w-[760px] text-[2.75rem] font-medium leading-[0.88] tracking-[-0.06em] text-[#f2eee7] sm:text-[4.2rem] md:text-[5.2rem] lg:text-[6rem]">
                Design the room
                <span className="block">
                  you&apos;ll love <span className="text-[#e8b777] italic">living in.</span>
                </span>
              </h1>

              <p className="max-w-[620px] text-base leading-7 text-[#a49d91] md:text-lg">
                Show us your space. Roomcraft reads the light, layout and mood,
                then suggests a plan that fits your budget.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid items-start gap-12 lg:grid-cols-[0.96fr_1.04fr] lg:gap-16"
          >
            <div className="animate-rise space-y-5" style={{ animationDelay: "120ms" }}>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-[#a49d91]">
                  Your room
                </h2>
                <span className="text-xs text-[#777166]">
                  {photos.length}/{MAX_IMAGES} photos
                </span>
              </div>

              {cameraOpen ? (
                <div className="overflow-hidden rounded-[24px]">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="aspect-[4/3] w-full bg-[#171715] object-cover"
                  />

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={photos.length >= MAX_IMAGES}
                      className="flex-1 rounded-full bg-[#e8b777] px-4 py-3 text-sm font-semibold text-[#11110f] transition hover:bg-[#f0c98d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Capture photo
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openCamera(
                          facingMode === "environment" ? "user" : "environment"
                        )
                      }
                      className="rounded-full border border-[#302e29] px-3 py-3 text-sm text-[#f2eee7] transition hover:border-[#4b453f]"
                      aria-label="Switch camera"
                      title="Switch camera"
                    >
                      ↻
                    </button>

                    <button
                      type="button"
                      onClick={stopCamera}
                      className="rounded-full border border-[#302e29] px-3 py-3 text-sm text-[#f2eee7] transition hover:border-[#4b453f]"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {photos.map((photo, index) => (
                    <figure
                      key={photo.id}
                      className={`photo-entrance group relative overflow-hidden rounded-[18px] bg-[#171715] ${
                       index === 0 ? "col-span-2 sm:col-span-2" : ""
                      }`}
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      <Image
                       src={photo.previewUrl}
                       alt={`Room photo ${index + 1}`}
                       width={900}
                       height={700}
                       className={`w-full object-cover transition duration-700 group-hover:scale-[1.025] ${
                         index === 0
                           ? "h-[260px] sm:h-[340px]"
                           : "h-[150px] sm:h-[165px]"
                       }`}
                      />
                      <button
                       type="button"
                       onClick={() => removePhoto(photo.id)}
                       disabled={loading}
                       aria-label={`Remove room photo ${index + 1}`}
                       className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#0d0d0b]/80 text-lg text-white backdrop-blur-sm transition hover:bg-[#0d0d0b] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                       ×
                      </button>
                    </figure>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[350px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[#3c3732] px-6 py-10 text-center sm:min-h-[420px] lg:min-h-[500px]">
                  <div className="text-3xl text-[#e8b777]" aria-hidden="true">
                    ◉
                  </div>

                  <h3 className="mt-5 text-[2.2rem] leading-none text-[#f2eee7]">
                    Start with a photo
                  </h3>

                  <p className="mt-3 text-sm text-[#a49d91]">
                    JPG, PNG or WebP · up to 5 MB each
                  </p>

                  <p className="mt-1 text-xs text-[#777166]">
                    Add at least one, up to five photos of your space.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {!cameraOpen && (
                  <button
                    type="button"
                    onClick={() => openCamera()}
                    disabled={loading || cameraLoading || photos.length >= MAX_IMAGES}
                    className="rounded-full bg-[#e8b777] px-5 py-3 text-sm font-medium text-[#11110f] transition hover:bg-[#f0c98d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cameraLoading ? "Opening camera..." : "Open camera"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || photos.length >= MAX_IMAGES}
                  className="rounded-full border border-[#302e29] px-5 py-3 text-sm text-[#f2eee7] transition hover:border-[#4b453f] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {photos.length ? "Add more photos" : "Upload photos"}
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => {
                  selectImages(event.target.files);
                  event.target.value = "";
                }}
                className="hidden"
                disabled={loading}
              />

              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="animate-rise space-y-7" style={{ animationDelay: "220ms" }}>
              <div className="space-y-7">
                <div>
                  <div className="mb-3 flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[#a49d91]">
                    <span className="text-[#e8b777]">01</span>
                    <span>Room</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5" role="group" aria-label="Choose a room type">
                    {ROOM_OPTIONS.map((option) => {
                      const selected = roomType === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setRoomType(option)}
                          className={[
                            "rounded-full border px-4 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b777]",
                            selected
                              ? "border-[#e8b777] bg-[#e8b777] text-[#1a1815]"
                              : "border-[#302e29] bg-transparent text-[#f2eee7] hover:border-[#4b453f]",
                          ].join(" ")}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[#a49d91]">
                    <span className="text-[#e8b777]">02</span>
                    <span>Style</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5" role="group" aria-label="Choose a design style">
                    {STYLE_OPTIONS.map((option) => {
                      const selected = style === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setStyle(option)}
                          className={[
                            "rounded-full border px-4 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b777]",
                            selected
                              ? "border-[#e8b777] bg-[#e8b777] text-[#1a1815]"
                              : "border-[#302e29] bg-transparent text-[#f2eee7] hover:border-[#4b453f]",
                          ].join(" ")}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[#a49d91]">
                      <span className="text-[#e8b777]">03</span>
                    <span>Budget</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-baseline justify-between gap-4">
                      <label htmlFor="budget" className="sr-only">
                        Budget in rupees
                      </label>
                      <div className="flex items-baseline gap-2">
                        <span className="font-serif text-3xl text-[#e8b777]" aria-hidden="true">
                          ₹
                        </span>
                        <input
                          id="budget"
                          type="number"
                          inputMode="numeric"
                          min={BUDGET_MIN}
                          max={BUDGET_MAX}
                          step={1}
                          required
                          value={budgetInput}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setBudgetInput(nextValue);
                            const amount = Number(nextValue);
                            if (
                              nextValue &&
                              Number.isFinite(amount) &&
                              amount >= BUDGET_MIN &&
                              amount <= BUDGET_MAX
                            ) {
                              setBudget(amount);
                            }
                          }}
                          onBlur={() => {
                            const amount = Number(budgetInput);
                            const validAmount =
                              budgetInput && Number.isFinite(amount)
                                ? Math.min(
                                    BUDGET_MAX,
                                    Math.max(BUDGET_MIN, amount)
                                  )
                                : budget;
                            setBudget(validAmount);
                            setBudgetInput(String(validAmount));
                          }}
                          className="w-48 max-w-full border-0 border-b border-[#49443c] bg-transparent py-1 text-3xl font-medium tracking-[-0.05em] text-[#f2eee7] outline-none transition focus:border-[#e8b777] sm:text-4xl"
                          aria-describedby="budget-limits"
                        />
                      </div>
                      <span className="text-sm text-[#a49d91]">
                        {formatIndianCurrency(budget)}
                      </span>
                    </div>

                    <input
                      aria-label="Adjust budget with range"
                      type="range"
                      min={BUDGET_MIN}
                      max={BUDGET_MAX}
                      step={1}
                      value={budget}
                      onChange={(event) => {
                        const amount = Number(event.target.value);
                        setBudget(amount);
                        setBudgetInput(String(amount));
                      }}
                      className="budget-slider mt-6 w-full"
                      style={{
                        background: `linear-gradient(to right, #e8b777 0%, #e8b777 ${sliderProgress}%, #2f2d2a ${sliderProgress}%, #2f2d2a 100%)`,
                      }}
                    />

                    <div
                      id="budget-limits"
                      className="mt-3 flex items-center justify-between text-xs text-[#a49d91]"
                    >
                      <span>{formatIndianCurrency(BUDGET_MIN)}</span>
                      <span>{formatIndianCurrency(BUDGET_MAX)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.18em] text-[#a49d91]">
                    <span className="text-[#e8b777]">04</span>
                    <label htmlFor="requirements">Your wishlist</label>
                  </div>

                  <textarea
                    id="requirements"
                    rows={4}
                    maxLength={500}
                    required
                    value={requirements}
                    onChange={(event) => setRequirements(event.target.value)}
                    placeholder="Warm lighting, walnut furniture, and a relaxing atmosphere"
                    className="w-full resize-y rounded-[14px] border border-[#302e29] bg-transparent px-4 py-3 text-base text-[#f2eee7] placeholder:text-[#777166] outline-none transition focus:border-[#e8b777]"
                  />

                  <div aria-live="polite" className="mt-2 text-right text-xs text-[#777166]">
                    {requirements.length}/500
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || cameraOpen || cameraLoading}
                  className="w-full rounded-full bg-[#e8b777] px-5 py-4 text-base font-semibold text-[#11110f] transition hover:-translate-y-0.5 hover:bg-[#f0c98d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b777] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Analyzing your room..." : "Analyze my room →"}
                </button>
              </div>

              <div aria-live="polite" className="mt-5">
                {loading && (
                  <div className="border-y border-[#302e29] py-4 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#e8b777]/20 border-t-[#e8b777]" />
                    <p className="mt-3 text-sm text-[#f2eee7]">
                      Gemini is analyzing your room...
                    </p>
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="border-l-2 border-[#b35d56] bg-[#2c1717]/40 p-4 text-sm text-[#f0c2bf]"
                  >
                    {error}
                  </div>
                )}

                {result && !loading && (
                  <div className="border-t border-[#302e29] pt-5">
                    <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#e8b777]">
                      Your room analysis is ready
                    </p>
                    <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#f2eee7]">
                      {result}
                    </div>
                    <button
                      type="button"
                      onClick={copyResult}
                      className="mt-4 rounded-full border border-[#302e29] px-4 py-2.5 text-sm text-[#f2eee7] transition hover:border-[#4b453f]"
                    >
                      Copy recommendations
                    </button>
                  </div>
                )}
              </div>
            </div>
          </form>
        </section>

        <p className="animate-fade mt-8 text-center text-xs text-[#777166]">
          Your photos are sent to Gemini for analysis and are not saved by Roomcraft.
        </p>
      </div>
    </main>
  );
}
