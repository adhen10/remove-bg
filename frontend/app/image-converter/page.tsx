"use client";

import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const FORMATS = [
    { value: "png", label: "PNG", description: "Mendukung transparansi" },
    { value: "jpg", label: "JPG", description: "Ukuran file lebih kecil" },
    { value: "webp", label: "WEBP", description: "Format modern untuk web" },
    { value: "bmp", label: "BMP", description: "Format bitmap" },
    { value: "tiff", label: "TIFF", description: "Untuk kebutuhan cetak dan arsip" },
] as const;

type OutputFormat = (typeof FORMATS)[number]["value"];
type Status = "idle" | "ready" | "loading" | "done" | "error";

const MIME_BY_FORMAT: Record<OutputFormat, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
};

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function baseName(filename: string) {
    return filename.replace(/\.[^.]+$/, "");
}

export default function ImageConverter() {
    const [file, setFile] = useState<File | null>(null);
    const [originalUrl, setOriginalUrl] = useState<string | null>(null);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [resultSize, setResultSize] = useState(0);
    const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
    const [quality, setQuality] = useState(90);
    const [backgroundColor, setBackgroundColor] = useState("#ffffff");
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const requestControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            if (originalUrl) URL.revokeObjectURL(originalUrl);
            if (resultUrl) URL.revokeObjectURL(resultUrl);
        };
    }, [originalUrl, resultUrl]);

    useEffect(() => {
        return () => requestControllerRef.current?.abort();
    }, []);

    const pickFile = (picked: File) => {
        requestControllerRef.current?.abort();
        requestControllerRef.current = null;

        const extension = picked.name.split(".").pop()?.toLowerCase() ?? "";
        const supported =
            ALLOWED_MIME_TYPES.has(picked.type) ||
            (!picked.type && ALLOWED_EXTENSIONS.has(extension));

        if (!supported) {
            setFile(null);
            setOriginalUrl(null);
            setResultUrl(null);
            setResultSize(0);
            setDimensions(null);
            setError("Format input yang didukung hanya JPG, PNG, dan WEBP.");
            setStatus("error");
            if (inputRef.current) inputRef.current.value = "";
            return;
        }

        if (picked.size > MAX_BYTES) {
            setFile(null);
            setOriginalUrl(null);
            setResultUrl(null);
            setResultSize(0);
            setDimensions(null);
            setError("Ukuran file maksimal 10 MB.");
            setStatus("error");
            if (inputRef.current) inputRef.current.value = "";
            return;
        }

        setFile(picked);
        setOriginalUrl(URL.createObjectURL(picked));
        setResultUrl(null);
        setResultSize(0);
        setDimensions(null);
        setError(null);
        setStatus("ready");
    };

    const convert = async () => {
        if (!file) return;

        const controller = new AbortController();
        requestControllerRef.current?.abort();
        requestControllerRef.current = controller;
        setStatus("loading");
        setError(null);
        setResultUrl(null);
        setResultSize(0);

        try {
            const form = new FormData();
            form.append("file", file);
            form.append("output_format", outputFormat);
            form.append("quality", String(quality));
            form.append("background_color", backgroundColor);

            const response = await fetch(`${API_URL}/convert-image`, {
                method: "POST",
                body: form,
                signal: controller.signal,
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.detail ?? "Gagal mengonversi gambar.");
            }

            const blob = await response.blob();
            if (blob.size === 0 || blob.type !== MIME_BY_FORMAT[outputFormat]) {
                throw new Error("Server tidak mengembalikan format gambar yang sesuai.");
            }

            setResultSize(blob.size);
            setResultUrl(URL.createObjectURL(blob));
            setStatus("done");
        } catch (caught) {
            if (controller.signal.aborted) return;
            setError(
                caught instanceof TypeError
                    ? "Tidak bisa terhubung ke server. Pastikan backend sudah berjalan."
                    : (caught as Error).message
            );
            setStatus("error");
        } finally {
            if (requestControllerRef.current === controller) {
                requestControllerRef.current = null;
            }
        }
    };

    const reset = () => {
        requestControllerRef.current?.abort();
        requestControllerRef.current = null;
        setFile(null);
        setOriginalUrl(null);
        setResultUrl(null);
        setResultSize(0);
        setDimensions(null);
        setError(null);
        setStatus("idle");
        setOutputFormat("png");
        setQuality(90);
        setBackgroundColor("#ffffff");
        if (inputRef.current) inputRef.current.value = "";
    };

    const downloadName = file
        ? `${baseName(file.name)}-converted.${outputFormat}`
        : `converted-image.${outputFormat}`;

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(false);
        const dropped = event.dataTransfer.files?.[0];
        if (dropped) pickFile(dropped);
    };

    return (
        <div className="flex min-h-screen flex-col text-stone-900">
            <SiteHeader />

            <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
                <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                            Konversi gambar
                        </h1>
                        <p className="mt-2 text-sm text-stone-500">
                            Ubah gambar ke PNG, JPG, atau WEBP sesuai kebutuhan.
                        </p>
                    </div>
                    <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500">
                        File tidak disimpan
                    </span>
                </header>

                {!file && (
                    <div
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={onDrop}
                        className={`flex flex-col items-center rounded-3xl border border-dashed px-6 py-14 text-center transition-colors ${dragging ? "border-[#46745a] bg-[#eaf1ec]" : "border-stone-300 bg-white"}`}
                    >
                        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eaf1ec] text-[#46745a]">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
                            </svg>
                        </span>
                        <p className="mt-6 text-lg font-semibold">
                            {dragging ? "Lepaskan gambar untuk memilih file" : "Tarik gambar ke sini"}
                        </p>
                        <p className="mt-1 text-sm text-stone-500">
                            atau pilih gambar dari perangkat kamu
                        </p>
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="mt-6 rounded-xl bg-[#46745a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3b6350] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#46745a] focus-visible:ring-offset-2"
                        >
                            Pilih gambar
                        </button>
                        <p className="mt-6 text-xs font-medium text-stone-500">
                            Input: JPG · JPEG · PNG · WEBP &nbsp;•&nbsp; Maks. 10 MB
                        </p>
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                            className="hidden"
                            onChange={(event) => {
                                const picked = event.target.files?.[0];
                                if (picked) pickFile(picked);
                            }}
                        />
                    </div>
                )}

                {status === "error" && !file && (
                    <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                        {error}
                    </p>
                )}

                {file && (
                    <section className="space-y-6">
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4">
                            <div className="min-w-0">
                                <p className="truncate font-medium">{file.name}</p>
                                <p className="text-sm text-stone-500">{formatBytes(file.size)}</p>
                            </div>
                            <button
                                type="button"
                                onClick={reset}
                                className="shrink-0 text-sm text-stone-500 hover:text-stone-900"
                            >
                                Ganti file
                            </button>
                        </div>

                        <div>
                            <p className="mb-3 text-sm font-medium text-stone-700">Format keluaran</p>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {FORMATS.map((format) => (
                                    <button
                                        key={format.value}
                                        type="button"
                                        disabled={status === "loading"}
                                        onClick={() => {
                                            setOutputFormat(format.value);
                                            setResultUrl(null);
                                            setResultSize(0);
                                            if (status === "done" || status === "error") setStatus("ready");
                                            setError(null);
                                        }}
                                        aria-pressed={outputFormat === format.value}
                                        className={`rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#46745a] ${outputFormat === format.value ? "border-[#6c9877] bg-[#f2f7f1] ring-1 ring-[#6c9877]" : "border-stone-200 bg-white hover:border-stone-300"}`}
                                    >
                                        <span className="block text-sm font-semibold">{format.label}</span>
                                        <span className="mt-1 block text-xs text-stone-500">{format.description}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {(outputFormat === "jpg" || outputFormat === "webp") && (
                            <div className="rounded-2xl border border-stone-200 bg-white p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <label htmlFor="image-quality" className="text-sm font-medium text-stone-700">
                                        Kualitas
                                    </label>
                                    <span className="text-sm font-semibold tabular-nums text-stone-700">{quality}%</span>
                                </div>
                                <input
                                    id="image-quality"
                                    type="range"
                                    disabled={status === "loading"}
                                    min="1"
                                    max="100"
                                    value={quality}
                                    onChange={(event) => setQuality(Number(event.target.value))}
                                    className="mt-4 w-full accent-[#46745a]"
                                />
                                <div className="mt-1 flex justify-between text-xs text-stone-400">
                                    <span>Ukuran lebih kecil</span>
                                    <span>Kualitas lebih tinggi</span>
                                </div>
                            </div>
                        )}

                        {(outputFormat === "jpg" || outputFormat === "bmp") && (
                            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-5">
                                <div>
                                    <p className="text-sm font-medium text-stone-700">Warna latar {outputFormat.toUpperCase()}</p>
                                    <p className="mt-1 text-xs text-stone-500">
                                        Area transparan akan diisi warna ini.
                                    </p>
                                </div>
                                <label className="flex items-center gap-3 text-sm text-stone-600">
                                    <span>{backgroundColor.toUpperCase()}</span>
                                    <input
                                        type="color"
                                        disabled={status === "loading"}
                                        value={backgroundColor}
                                        onChange={(event) => setBackgroundColor(event.target.value)}
                                        aria-label={`Pilih warna latar ${outputFormat.toUpperCase()}`}
                                        className="h-9 w-12 cursor-pointer rounded border border-stone-200 bg-white p-1"
                                    />
                                </label>
                            </div>
                        )}

                        {status !== "done" && (
                            <button
                                type="button"
                                onClick={convert}
                                disabled={status === "loading"}
                                aria-busy={status === "loading"}
                                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#46745a] px-5 py-3 text-sm font-medium text-white hover:bg-[#3b6350] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#46745a] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                            >
                                {status === "loading" ? (
                                    <>
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                                        Mengonversi gambar...
                                    </>
                                ) : (
                                    <>Konversi ke {outputFormat.toUpperCase()} <span aria-hidden="true">↗</span></>
                                )}
                            </button>
                        )}

                        {status === "loading" && (
                            <p className="text-center text-sm text-stone-500" role="status">
                                Gambar sedang diproses. Mohon tunggu.
                            </p>
                        )}

                        {status === "error" && file && (
                            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                                {error}
                            </p>
                        )}

                        {status === "done" && resultUrl && (
                            <div className="space-y-4 rounded-3xl border border-[#46745a]/25 bg-[#f5f8f4] p-5 sm:p-6">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-stone-800">Konversi selesai</p>
                                        <p className="mt-1 text-xs text-stone-500">Hasil dalam format {outputFormat.toUpperCase()}</p>
                                    </div>
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#46745a]">Selesai</span>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <figure className="min-w-0">
                                        <figcaption className="mb-2 text-xs font-medium text-stone-500">Gambar asli</figcaption>
                                        <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white p-3">
                                            {originalUrl && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={originalUrl}
                                                    alt="Gambar asli"
                                                    onLoad={(event) => setDimensions({
                                                        width: event.currentTarget.naturalWidth,
                                                        height: event.currentTarget.naturalHeight,
                                                    })}
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                            )}
                                        </div>
                                    </figure>
                                    <figure className="min-w-0">
                                        <figcaption className="mb-2 text-xs font-medium text-stone-500">Hasil konversi</figcaption>
                                        <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white p-3">
                                            {outputFormat === "tiff" ? (
                                                <div className="max-w-xs text-center">
                                                    <div className="text-lg font-semibold tracking-wide text-stone-700">TIFF</div>
                                                    <p className="mt-2 text-xs leading-relaxed text-stone-500">
                                                        Preview TIFF belum didukung sebagian besar browser. Unduh file untuk membukanya di aplikasi gambar.
                                                    </p>
                                                </div>
                                            ) : (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={resultUrl} alt={`Hasil gambar ${outputFormat.toUpperCase()}`} className="max-h-full max-w-full object-contain" />
                                            )}
                                        </div>
                                    </figure>
                                </div>

                                <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-white px-4 py-3 text-xs text-stone-500">
                                    <span>Dimensi: <strong className="font-semibold text-stone-700">{dimensions ? `${dimensions.width} × ${dimensions.height} px` : "—"}</strong></span>
                                    <span>Asli: <strong className="font-semibold text-stone-700">{formatBytes(file.size)}</strong></span>
                                    <span>Hasil: <strong className="font-semibold text-stone-700">{formatBytes(resultSize)}</strong></span>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <a
                                        href={resultUrl}
                                        download={downloadName}
                                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#46745a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3b6350]"
                                    >
                                        Unduh {outputFormat.toUpperCase()} ↓
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setResultUrl(null);
                                            setResultSize(0);
                                            setStatus("ready");
                                        }}
                                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                                    >
                                        Ubah pengaturan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={reset}
                                        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                                    >
                                        Gambar lain
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </main>

            <footer className="mx-auto flex w-full max-w-6xl justify-between border-t border-black/10 px-6 py-6 text-xs text-stone-500">
                <span>remove-bg</span>
                <span>Image tools · convert</span>
            </footer>
        </div>
    );
}
