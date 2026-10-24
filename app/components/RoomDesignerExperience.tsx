"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

type RoomDesignerExperienceProps = {
  variant: "wizard" | "studio";
};

type RoomPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

type DesignResult = {
  result?: string;
  error?: string;
};

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BUDGET_MIN = 5000;
const BUDGET_MAX = 200000;
const ROOM_OPTIONS = ["Bedroom", "Living room", "Kitchen", "Study", "Bathroom"];
const STYLE_OPTIONS = [
  "Modern minimal",
  "Japandi",
  "Scandinavian",
  "Warm industrial",
];
const MUST_HAVE_OPTIONS = [
  "Warm lighting",
  "Walnut",
  "Storage",
  "Plants",
  "Pet-friendly",
];
const STEPS = ["Photos", "Space", "Budget", "Details"];

function formatRupees(value: number) {
  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

export default function RoomDesignerExperience({
  variant,
}: RoomDesignerExperienceProps) {
  const isWizard = variant === "wizard";
  const [step, setStep] = useState(0);
  const [roomType, setRoomType] = useState("Bedroom");
  const [style, setStyle] = useState("Modern minimal");
  const [budgetMin, setBudgetMin] = useState(15000);
  const [budgetMax, setBudgetMax] = useState(40000);
  const [budgetMinInput, setBudgetMinInput] = useState("15000");
  const [budgetMaxInput, setBudgetMaxInput] = useState("40000");
  const [requirements, setRequirements] = useState("");
  const [mustHaves, setMustHaves] = useState<string[]>([
    "Warm lighting",
    "Walnut",
  ]);
  const [photos, setPhotos] = useState<RoomPhoto[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photosRef = useRef(photos);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    },
    []
  );

  useEffect(() => {
    if (!cameraOpen || !cameraStream || !videoRef.current) return;
    videoRef.current.srcObject = cameraStream;
    videoRef.current
      .play()
      .catch((playError: unknown) =>
        console.warn("Camera preview playback was interrupted.", playError)
      );
  }, [cameraOpen, cameraStream]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStream(null);
    setCameraOpen(false);
    setCameraLoading(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function openCamera(mode = facingMode) {
    setError("");
    setCameraLoading(true);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Camera access needs a supported browser and a secure connection."
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
      } catch (cameraError) {
        if (
          cameraError instanceof Error &&
          cameraError.name !== "OverconstrainedError" &&
          cameraError.name !== "NotFoundError"
        ) {
          throw cameraError;
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
    } catch (cameraError) {
      const name =
        cameraError instanceof Error ? cameraError.name : "UnknownError";
      if (name === "NotAllowedError") {
        setError("Camera access was denied. Allow permission or upload a photo.");
      } else if (name === "NotFoundError") {
        setError("No camera was found. Please upload a photo instead.");
      } else if (name === "NotReadableError") {
        setError("The camera is busy. Close other apps using it and try again.");
      } else {
        setError(
          cameraError instanceof Error
            ? cameraError.message
            : "Unable to open the camera. Please upload a photo instead."
        );
      }
      stopCamera();
    } finally {
      setCameraLoading(false);
    }
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList);

    if (photos.length + files.length > MAX_IMAGES) {
      setError(`You can add up to ${MAX_IMAGES} photos.`);
      return;
    }
    if (files.some((file) => !ALLOWED_TYPES.includes(file.type))) {
      setError("Choose JPG, PNG, or WebP images.");
      return;
    }
    if (files.some((file) => file.size > MAX_IMAGE_SIZE)) {
      setError("Each photo must be 5 MB or smaller.");
      return;
    }

    const newPhotos = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      return { id: previewUrl, file, previewUrl };
    });
    setPhotos((current) => [...current, ...newPhotos]);
    setError("");
    setResult("");
    stopCamera();
  }

  function removePhoto(id: string) {
    const photo = photos.find((item) => item.id === id);
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPhotos((current) => current.filter((item) => item.id !== id));
    setResult("");
    setError("");
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video?.videoWidth || !video.videoHeight || !canvas) {
      setError("The camera is not ready yet. Please try again.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Unable to capture a photo. Please try again.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Unable to capture a photo. Please try again.");
          return;
        }
        if (photos.length >= MAX_IMAGES) {
          setError(`You can add up to ${MAX_IMAGES} photos.`);
          return;
        }
        if (blob.size > MAX_IMAGE_SIZE) {
          setError("The captured photo is over 5 MB. Try a lower resolution.");
          return;
        }

        const file = new File([blob], `room-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const previewUrl = URL.createObjectURL(file);
        setPhotos((current) => [
          ...current,
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

  function updateBudgetMin(value: number) {
    const next = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, value));
    const bounded = Math.min(next, budgetMax);
    setBudgetMin(bounded);
    setBudgetMinInput(String(bounded));
  }

  function updateBudgetMax(value: number) {
    const next = Math.max(BUDGET_MIN, Math.min(BUDGET_MAX, value));
    const bounded = Math.max(next, budgetMin);
    setBudgetMax(bounded);
    setBudgetMaxInput(String(bounded));
  }

  function commitBudgetMin() {
    const amount = Number(budgetMinInput);
    const bounded =
      budgetMinInput && Number.isFinite(amount)
        ? Math.min(budgetMax, Math.max(BUDGET_MIN, Math.min(BUDGET_MAX, amount)))
        : budgetMin;
    setBudgetMin(bounded);
    setBudgetMinInput(String(bounded));
  }

  function commitBudgetMax() {
    const amount = Number(budgetMaxInput);
    const bounded =
      budgetMaxInput && Number.isFinite(amount)
        ? Math.max(budgetMin, Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, amount)))
        : budgetMax;
    setBudgetMax(bounded);
    setBudgetMaxInput(String(bounded));
  }

  function toggleMustHave(option: string) {
    setMustHaves((current) =>
      current.includes(option)
        ? current.filter((value) => value !== option)
        : [...current, option]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photos.length) {
      setError("Add at least one room photo to continue.");
      if (isWizard) setStep(0);
      return;
    }
    setLoading(true);
    setError("");
    setResult("");

    try {
      const formData = new FormData();
      formData.append("roomType", roomType);
      formData.append("style", style);
      formData.append(
        "budget",
        `${formatRupees(budgetMin)} to ${formatRupees(budgetMax)}`
      );
      const wishlist = [
        mustHaves.length ? `Must-haves: ${mustHaves.join(", ")}.` : "",
        requirements.trim(),
      ]
        .filter(Boolean)
        .join(" ");
      formData.append("requirements", wishlist || "No additional requests.");
      photos.forEach(({ file }) => formData.append("image", file));

      const response = await fetch("/api/designUsingGemini", {
        method: "POST",
        body: formData,
      });
      const data: DesignResult = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to create your design plan.");
      }
      setResult(data.result || "No recommendations were returned.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to connect to Gemini. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function selectPill<T extends string>(
    options: T[],
    selected: T,
    onSelect: (value: T) => void,
    label: string,
    dark: boolean
  ) {
    return (
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={selected === option}
            onClick={() => onSelect(option)}
            className={`rounded-xl border px-3.5 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 ${
              dark
                ? selected === option
                  ? "border-[#c7f36b] bg-[#c7f36b] text-[#101418]"
                  : "border-[#2a333d] text-[#d5dce3] hover:border-[#63717d]"
                : selected === option
                  ? "border-[#151515] bg-[#151515] text-white"
                  : "border-[#dededb] bg-white text-[#171717] hover:border-[#999]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  function photoTiles(dark: boolean) {
    return (
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: MAX_IMAGES }, (_, index) => {
          const photo = photos[index];
          return photo ? (
            <figure
              key={photo.id}
              className={`group relative aspect-square overflow-hidden rounded-xl ${
                dark ? "bg-[#252f39]" : "bg-[#d4cec2]"
              }`}
            >
              <Image
                src={photo.previewUrl}
                alt={`Room photo ${index + 1}`}
                fill
                sizes="(max-width: 640px) 20vw, 140px"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[10px] text-white">
                Photo {index + 1}
              </figcaption>
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                disabled={loading}
                aria-label={`Remove photo ${index + 1}`}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm text-black disabled:cursor-not-allowed"
              >
                ×
              </button>
            </figure>
          ) : (
            <button
              key={`empty-${index}`}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || photos.length >= MAX_IMAGES}
              aria-label={`Add photo ${index + 1}`}
              className={`flex aspect-square items-center justify-center rounded-xl border border-dashed text-2xl transition hover:border-current disabled:cursor-not-allowed disabled:opacity-50 ${
                dark
                  ? "border-[#2a333d] text-[#8996a4]"
                  : "border-[#d8d8d4] text-[#777]"
              }`}
            >
              +
            </button>
          );
        })}
      </div>
    );
  }

  function cameraPreview(dark: boolean) {
    if (!cameraOpen) return null;
    return (
      <div className="mb-4 overflow-hidden rounded-2xl">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`aspect-[4/3] w-full object-cover ${
            dark ? "bg-[#151b21]" : "bg-[#f1f1ed]"
          }`}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={capturePhoto}
            disabled={photos.length >= MAX_IMAGES}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              dark
                ? "bg-[#c7f36b] text-[#101418]"
                : "bg-[#151515] text-white"
            }`}
          >
            Take photo
          </button>
          <button
            type="button"
            onClick={() =>
              openCamera(facingMode === "environment" ? "user" : "environment")
            }
            className={`rounded-xl border px-4 py-2.5 text-sm ${
              dark
                ? "border-[#2a333d] text-[#e8edf2]"
                : "border-[#ddd] text-[#171717]"
            }`}
          >
            Switch camera
          </button>
          <button
            type="button"
            onClick={stopCamera}
            className={`rounded-xl border px-4 py-2.5 text-sm ${
              dark
                ? "border-[#2a333d] text-[#e8edf2]"
                : "border-[#ddd] text-[#171717]"
            }`}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  function budgetRange(dark: boolean) {
    const textClass = dark ? "text-[#e8edf2]" : "text-[#181818]";
    const mutedClass = dark ? "text-[#93a0ad]" : "text-[#73736f]";
    const fieldClass = dark
      ? "border-[#2a333d] bg-[#11171d] text-[#e8edf2] focus:border-[#c7f36b]"
      : "border-[#dededb] bg-white text-[#181818] focus:border-[#ff553b]";

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "Min (₹)",
              value: budgetMinInput,
              setValue: setBudgetMinInput,
              other: budgetMax,
              update: setBudgetMin,
              commit: commitBudgetMin,
            },
            {
              label: "Max (₹)",
              value: budgetMaxInput,
              setValue: setBudgetMaxInput,
              other: budgetMin,
              update: setBudgetMax,
              commit: commitBudgetMax,
            },
          ].map((field) => (
            <label key={field.label} className="block">
              <span className={`mb-1.5 block text-xs ${mutedClass}`}>
                {field.label}
              </span>
              <input
                type="number"
                min={BUDGET_MIN}
                max={BUDGET_MAX}
                step={1000}
                value={field.value}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  field.setValue(value);
                  const amount = Number(value);
                  if (
                    value &&
                    Number.isFinite(amount) &&
                    amount >= BUDGET_MIN &&
                    amount <= BUDGET_MAX
                  ) {
                    field.update(
                      field.label.startsWith("Min")
                        ? Math.min(amount, field.other)
                        : Math.max(amount, field.other)
                    );
                  }
                }}
                onBlur={field.commit}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none ${fieldClass}`}
              />
            </label>
          ))}
        </div>
        <div className="space-y-2">
          <label className="block">
            <span className="sr-only">Minimum budget range</span>
            <input
              type="range"
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={1000}
              value={budgetMin}
              onChange={(event) => updateBudgetMin(Number(event.currentTarget.value))}
              className={`budget-slider w-full ${dark ? "budget-slider-lime" : "budget-slider-coral"}`}
              aria-label="Minimum budget"
            />
          </label>
          <label className="block">
            <span className="sr-only">Maximum budget range</span>
            <input
              type="range"
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={1000}
              value={budgetMax}
              onChange={(event) => updateBudgetMax(Number(event.currentTarget.value))}
              className={`budget-slider w-full ${dark ? "budget-slider-lime" : "budget-slider-coral"}`}
              aria-label="Maximum budget"
            />
          </label>
        </div>
        <div className={`flex justify-between text-xs ${mutedClass}`}>
          <span>{formatRupees(BUDGET_MIN)}</span>
          <span>{formatRupees(BUDGET_MAX)}</span>
        </div>
        <p className={`text-sm font-medium ${textClass}`}>
          {formatRupees(budgetMin)} to {formatRupees(budgetMax)}
        </p>
      </div>
    );
  }

  function resultPanel(dark: boolean) {
    if (loading) {
      return (
        <div
          role="status"
          className={`mt-6 border-t pt-5 text-sm ${
            dark ? "border-[#29323c] text-[#d5dce3]" : "border-[#e2e2dd] text-[#444]"
          }`}
        >
          Creating your room plan...
        </div>
      );
    }
    if (error) {
      return (
        <p
          role="alert"
          className={`mt-5 border-l-2 px-4 py-3 text-sm ${
            dark
              ? "border-[#c7f36b] bg-[#1c2522] text-[#e7edf2]"
              : "border-[#ff553b] bg-[#fff0ed] text-[#4a2118]"
          }`}
        >
          {error}
        </p>
      );
    }
    if (!result) return null;
    async function copyResult() {
      try {
        await navigator.clipboard.writeText(result);
      } catch {
        setError("Unable to copy the recommendations.");
      }
    }
    return (
      <section
        aria-live="polite"
        className={`mt-6 border-t pt-5 ${
          dark ? "border-[#29323c]" : "border-[#e2e2dd]"
        }`}
      >
        <h2 className={`text-lg font-semibold ${dark ? "text-white" : "text-[#171717]"}`}>
          Your design plan
        </h2>
        <p
          className={`mt-3 whitespace-pre-wrap text-sm leading-7 ${
            dark ? "text-[#cbd2d9]" : "text-[#454541]"
          }`}
        >
          {result}
        </p>
        <button
          type="button"
          onClick={copyResult}
          className={`mt-4 text-sm underline underline-offset-4 ${
            dark ? "text-[#c7f36b]" : "text-[#171717]"
          }`}
        >
          Copy recommendations
        </button>
      </section>
    );
  }

  const brief = [
    ["Photos", `${photos.length} of ${MAX_IMAGES}`],
    ["Room", roomType],
    ["Style", style],
    ["Budget", `${formatRupees(budgetMin)} to ${formatRupees(budgetMax)}`],
    ["Must-haves", mustHaves.length ? mustHaves.join(", ") : "Not set"],
  ];

  if (isWizard) {
    return (
      <main className="wizard-page min-h-screen text-[#e8edf2]">
        <div className="mx-auto max-w-[1440px] px-5 pb-12 pt-6 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-tight">
              roomcraft<span className="text-[#c7f36b]">.</span>
            </Link>
            <nav className="flex items-center gap-4 text-xs text-[#9ba6b2]">
              <span className="hidden sm:inline">Takes about 2 minutes</span>
              <Link href="/page-2" className="hover:text-white">
                Page 2
              </Link>
            </nav>
          </header>

          <div className="mt-12 grid gap-10 lg:grid-cols-[180px_minmax(0,1fr)_300px]">
            <nav aria-label="Design steps" className="flex gap-2 lg:flex-col">
              {STEPS.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setError("");
                    setStep(index);
                  }}
                  aria-current={step === index ? "step" : undefined}
                  aria-label={`Step ${index + 1}: ${name}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                    step === index
                      ? "text-white"
                      : "text-[#87939f] hover:text-[#dce3e9]"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                      step === index
                        ? "border-[#c7f36b] bg-[#c7f36b] font-bold text-[#101418]"
                        : "border-[#2a333d]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="hidden sm:inline">{name}</span>
                </button>
              ))}
            </nav>

            <form id="wizard-form" onSubmit={handleSubmit} className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c7f36b]">
                Step {step + 1} of 4
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                {[
                  "Show us the room.",
                  "Tell us about your space.",
                  "Set a comfortable budget.",
                  "Add the finishing details.",
                ][step]}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-[#9ba6b2]">
                {[
                  "Add 1 to 5 photos from different angles. Natural light gives the best read.",
                  "Choose the room and the style you want to come home to.",
                  "Share a comfortable range. We will keep recommendations within it.",
                  "Tell us what matters most and anything else you would like included.",
                ][step]}
              </p>

              <div className="mt-7">
                {step === 0 && (
                  <>
                    {cameraPreview(true)}
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => openCamera()}
                        disabled={cameraLoading || photos.length >= MAX_IMAGES}
                        className="rounded-xl bg-[#c7f36b] px-5 py-3 text-sm font-semibold text-[#101418] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {cameraLoading ? "Opening camera..." : "Take photo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={photos.length >= MAX_IMAGES}
                        className="rounded-xl border border-[#2a333d] px-5 py-3 text-sm font-semibold text-[#e8edf2] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Upload photos
                      </button>
                    </div>
                    {photoTiles(true)}
                    <p className="mt-3 text-xs text-[#8f9ba7]">
                      {photos.length} of {MAX_IMAGES} added · JPG, PNG or WebP, 5 MB each
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) => {
                        addFiles(event.currentTarget.files);
                        event.currentTarget.value = "";
                      }}
                      className="hidden"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                  </>
                )}

                {step === 1 && (
                  <div className="space-y-8">
                    <section>
                      <h2 className="mb-3 text-sm font-medium text-[#9ba6b2]">
                        Room type
                      </h2>
                      {selectPill(ROOM_OPTIONS, roomType, setRoomType, "Room type", true)}
                    </section>
                    <section>
                      <h2 className="mb-3 text-sm font-medium text-[#9ba6b2]">
                        Design style
                      </h2>
                      {selectPill(STYLE_OPTIONS, style, setStyle, "Design style", true)}
                    </section>
                  </div>
                )}

                {step === 2 && budgetRange(true)}

                {step === 3 && (
                  <section className="space-y-5">
                    <fieldset>
                      <legend className="mb-3 text-sm font-medium text-[#9ba6b2]">
                        Must-haves
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {MUST_HAVE_OPTIONS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={mustHaves.includes(option)}
                            onClick={() => toggleMustHave(option)}
                            className={`rounded-xl border px-3.5 py-2 text-sm ${
                              mustHaves.includes(option)
                                ? "border-[#c7f36b] bg-[#c7f36b] text-[#101418]"
                                : "border-[#2a333d] text-[#d5dce3]"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <label className="block text-sm text-[#9ba6b2]">
                      Anything else?
                      <textarea
                        value={requirements}
                        onChange={(event) => setRequirements(event.target.value)}
                        maxLength={500}
                        rows={4}
                        placeholder="Tell us the mood you want..."
                        className="mt-2 w-full resize-y rounded-xl border border-[#2a333d] bg-[#11171d] px-4 py-3 text-sm text-white outline-none focus:border-[#c7f36b]"
                      />
                      <span className="mt-1 block text-right text-xs text-[#81909e]">
                        {requirements.length}/500
                      </span>
                    </label>
                  </section>
                )}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((current) => current - 1)}
                    className="rounded-xl border border-[#2a333d] px-5 py-3 text-sm font-semibold"
                  >
                    Back
                  </button>
                )}
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 0 && photos.length === 0) {
                        setError("Add at least one room photo to continue.");
                        return;
                      }
                      setError("");
                      setStep((current) => current + 1);
                    }}
                    className="rounded-xl bg-[#e8edf2] px-6 py-3 text-sm font-semibold text-[#14191e]"
                  >
                    Continue <span aria-hidden="true">→</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading || cameraOpen}
                    className="rounded-xl bg-[#c7f36b] px-6 py-3 text-sm font-semibold text-[#101418] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Creating your plan..." : "Generate my plan"}
                  </button>
                )}
              </div>

              {resultPanel(true)}
            </form>

            <aside className="h-fit rounded-[24px] border border-[#232c35] bg-[#141b22] p-5 lg:sticky lg:top-8">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#8c99a6]">
                Your brief
              </h2>
              <dl className="mt-3 divide-y divide-[#252e37]">
                {brief.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-3 py-3 text-xs"
                  >
                    <dt className="text-[#91a0ad]">{label}</dt>
                    <dd className="max-w-[65%] text-right font-semibold text-[#e8edf2]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                onClick={() => {
                  if (!photos.length) {
                    setStep(0);
                    setError("Add at least one room photo to continue.");
                    return;
                  }
                  document
                    .querySelector<HTMLFormElement>("#wizard-form")
                    ?.requestSubmit();
                }}
                disabled={loading || cameraOpen}
                className="mt-4 w-full rounded-xl bg-[#c7f36b] px-4 py-3.5 text-sm font-bold text-[#101418] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating your plan..." : "Generate my plan"}
              </button>
              <p className="mt-3 text-center text-[11px] leading-4 text-[#83909c]">
                Photos go to Gemini for analysis and are not saved by Roomcraft.
              </p>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="studio-page min-h-screen text-[#171717]">
      <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-[#ff553b]" />
            roomcraft
          </Link>
          <Link
            href="/page-1"
            className="rounded-full border border-[#c9c9c4] px-4 py-2 text-xs font-medium transition hover:bg-white"
          >
            Page 1
          </Link>
        </header>

        <section className="mb-7 mt-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <h1 className="max-w-[900px] text-[2.5rem] font-bold leading-[0.94] tracking-[-0.07em] sm:text-6xl">
            Photos in.{" "}
            <span className="whitespace-nowrap rounded-xl bg-[#ff553b] px-2 text-[#171717]">
              Design plan
            </span>
            <br />
            out.
          </h1>
          <p className="max-w-[300px] text-sm leading-6 text-[#666660]">
            Add up to five photos of your room, set a budget, and get a styled
            plan with a shopping list.
          </p>
        </section>

        <form
          onSubmit={handleSubmit}
          className="grid gap-8 rounded-[26px] border border-[#e6e6e1] bg-white p-5 sm:p-7 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:p-8"
        >
          <section>
            <div className="mb-2 flex justify-between text-xs font-medium">
              <h2>Room photos</h2>
              <span>
                {photos.length}/{MAX_IMAGES} · at least 1
              </span>
            </div>
            {cameraPreview(false)}
            {!cameraOpen && (
              <div className="flex min-h-[150px] flex-col items-center justify-center rounded-2xl bg-[#f3f3f0] px-4 py-5 text-center">
                <span className="text-2xl" aria-hidden="true">
                  ◉
                </span>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera()}
                    disabled={cameraLoading || photos.length >= MAX_IMAGES}
                    className="rounded-full bg-[#151515] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cameraLoading ? "Opening..." : "Take photo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photos.length >= MAX_IMAGES}
                    className="rounded-full border border-[#dededb] bg-white px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Upload from device
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-[#72726d]">
                  JPG, PNG or WebP · 5 MB each
                </p>
              </div>
            )}
            {photoTiles(false)}
            <p className="mt-3 text-xs text-[#777]">
              Tip: one wide shot plus a close-up of each wall works best.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => {
                addFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
              className="hidden"
            />
            <canvas ref={canvasRef} className="hidden" />
          </section>

          <section className="space-y-5">
            <div>
              <h2 className="mb-2 text-xs">Room type</h2>
              {selectPill(ROOM_OPTIONS, roomType, setRoomType, "Room type", false)}
            </div>
            <div>
              <h2 className="mb-2 text-xs">Style</h2>
              {selectPill(STYLE_OPTIONS, style, setStyle, "Design style", false)}
            </div>
            <section>
              <h2 className="mb-3 text-xs">Budget range</h2>
              {budgetRange(false)}
            </section>
            <fieldset>
              <legend className="mb-2 text-xs">Must-haves</legend>
              <div className="flex flex-wrap gap-2">
                {MUST_HAVE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={mustHaves.includes(option)}
                    onClick={() => toggleMustHave(option)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      mustHaves.includes(option)
                        ? "border-[#151515] bg-[#151515] text-white"
                        : "border-[#dededb] bg-white text-[#171717] hover:border-[#999]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="block text-xs">
              Anything else?
              <textarea
                value={requirements}
                onChange={(event) => setRequirements(event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Tell us the mood you want"
                className="mt-2 w-full resize-y rounded-xl border border-[#dededb] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#ff553b]"
              />
              <span className="mt-1 block text-right text-[10px] text-[#777]">
                {requirements.length}/500
              </span>
            </label>
            <button
              type="submit"
              disabled={loading || cameraOpen}
              className="w-full rounded-full bg-[#151515] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating your design..." : "Get my design plan →"}
            </button>
            {resultPanel(false)}
          </section>
        </form>

        <p className="mt-5 text-center text-[11px] text-[#777]">
          Photos are sent to Gemini for analysis and are not saved by Roomcraft.
        </p>
      </div>
    </main>
  );
}
