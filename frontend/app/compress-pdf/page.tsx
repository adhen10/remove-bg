"use client";

import { useEffect, useRef, useState } from "react";
import SiteHeader from "../../components/SiteHeader";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const MAX_BYTES = 50 * 1024 * 1024;

const LEVELS = [
    { value: "low", label: "Ringan", hint: "Kualitas gambar hampir sama" },
    { value: "medium", label: "Sedang", hint: "Seimbang, cocok untuk kebanyakan file" },
    { value: "high", label: "Maksimal", hint: "File paling kecil, gambar agak turun" },
] as const;

type Level = (typeof LEVELS)[number]["value"];
type Status = "idle" | "ready" | "loading" | "done" | "error";

function formatBytes(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CompressPdf() {
    const [file, setFile] = useState<File | null>(null);
    const [level, setLevel] = useState<Level>("medium");
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [resultSize, setResultSize] = useState(0);
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        return () => {
            if (resultUrl) URL.revokeObjectURL(resultUrl);
        };
    }, [resultUrl]);

    const pick = (picked: File) => {
        const isPdf =
            picked.type === "application/pdf" ||
            picked.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
            setFile(null);
            setResultUrl(null);
            setResultSize(0);
            setError("File harus berformat PDF.");
            setStatus("error");
            if (inputRef.current) inputRef.current.value = "";
            return;
        }
        if (picked.size > MAX_BYTES) {
            setFile(null);
            setResultUrl(null);
            setResultSize(0);
            setError(`Ukuran file maksimal ${formatBytes(MAX_BYTES)}.`);
            setStatus("error");
            if (inputRef.current) inputRef.current.value = "";
            return;
        }
        setFile(picked);
        setResultUrl(null);
        setResultSize(0);
        setError(null);
        setStatus("ready");
    };

    const compress = async () => {
        if (!file) return;
        setStatus("loading");
        setError(null);
        setResultUrl(null);
        setResultSize(0);

        try {
            const form = new FormData();
            form.append("file", file);
            form.append("level", level);
            const res = await fetch(`${API_URL}/compress-pdf`, { method: "POST", body: form });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.detail ?? "Gagal mengompres PDF.");
            }
            const blob = await res.blob();
            setResultSize(blob.size);
            setResultUrl(URL.createObjectURL(blob));
            setStatus("done");
        } catch (e) {
            setError(
                e instanceof TypeError
                    ? "Tidak bisa terhubung ke server. Pastikan backend sudah berjalan."
                    : (e as Error).message
            );
            setStatus("error");
        }
    };

    const reset = () => {
        setFile(null);
        setResultUrl(null);
        setError(null);
        setStatus("idle");
        if (inputRef.current) inputRef.current.value = "";
    };

    const saved = file ? Math.max(0, Math.round((1 - resultSize / file.size) * 100)) : 0;
    const downloadName = file
        ? `${file.name.replace(/\.pdf$/i, "")}-compressed.pdf`
        : "compressed.pdf";

    return (
        <div className="flex min-h-screen flex-col text-stone-900">
            <SiteHeader />

            <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
                <header className="mb-8">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        Kecilkan ukuran PDF
                    </h1>
                    <p className="mt-2 text-sm text-stone-500">
                        Cocok untuk PDF hasil scan atau banyak gambar. File tidak disimpan di server.
                    </p>
                </header>

                {!file && (
                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragging(false);
                            const dropped = e.dataTransfer.files?.[0];
                            if (dropped) pick(dropped);
                        }}
                        className={`flex flex-col items-center rounded-3xl border border-dashed px-6 py-14 text-center transition-colors ${dragging ? "border-[#46745a] bg-[#eaf1ec]" : "border-stone-300 bg-white"
                            }`}
                    >
                        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eaf1ec] text-[#46745a]">
                            <svg
                                width="28"
                                height="28"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
                            </svg>
                        </span>
                        <p className="mt-6 text-lg font-semibold">Tarik file PDF ke sini</p>
                        <p className="mt-1 text-sm text-stone-500">atau pilih file dari perangkat kamu</p>
                        <button
                            onClick={() => inputRef.current?.click()}
                            className="mt-6 rounded-xl bg-[#46745a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3b6350] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#46745a] focus-visible:ring-offset-2"
                        >
                            Pilih PDF
                        </button>
                        <p className="mt-6 text-xs font-medium text-stone-500">
                            PDF &nbsp;•&nbsp; Maks. {formatBytes(MAX_BYTES)}
                        </p>
                        <input
                            ref={inputRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            onChange={(e) => {
                                const picked = e.target.files?.[0];
                                if (picked) pick(picked);
                            }}
                        />
                    </div>
                )}

                {status === "error" && !file && (
                    <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
                )}

                {file && (
                    <section className="space-y-6">
                        <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4">
                            <div className="min-w-0">
                                <p className="truncate font-medium">{file.name}</p>
                                <p className="text-sm text-stone-500">{formatBytes(file.size)}</p>
                            </div>
                            <button
                                onClick={reset}
                                disabled={status === "loading"}
                                className="text-sm text-stone-500 hover:text-stone-900 disabled:opacity-50"
                            >
                                Ganti file
                            </button>
                        </div>

                        <fieldset disabled={status === "loading"}>
                            <legend className="mb-2 text-sm font-medium text-stone-600">
                                Tingkat kompresi
                            </legend>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {LEVELS.map((l) => (
                                    <label
                                        key={l.value}
                                        className={`pdf-level-card ${level === l.value ? "is-selected" : ""}`}
                                    >
                                        <input
                                            type="radio"
                                            name="level"
                                            value={l.value}
                                            checked={level === l.value}
                                            onChange={() => {
                                                if (level !== l.value) {
                                                    setLevel(l.value);
                                                    setResultUrl(null);
                                                    setResultSize(0);
                                                    if (status === "done") setStatus("ready");
                                                }
                                            }}
                                            className="sr-only"
                                        />
                                        <span className="pdf-level-top">
                                            <span className="block text-sm font-medium">{l.label}</span>
                                            <span className="pdf-level-indicator" aria-hidden="true">
                                                {level === l.value ? "✓" : ""}
                                            </span>
                                        </span>
                                        <span className="mt-1 block text-xs text-stone-500">{l.hint}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        {status !== "done" && (
                            <button
                                onClick={compress}
                                disabled={status === "loading"}
                                aria-busy={status === "loading"}
                                className="pdf-compress-button w-full rounded-xl bg-[#46745a] px-5 py-3 text-sm font-medium text-white hover:bg-[#3b6350] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#46745a] focus-visible:ring-offset-2 disabled:opacity-60"
                            >
                                {status === "loading" ? (
                                    <>
                                        <span className="pdf-button-spinner" aria-hidden="true" />
                                        Sedang mengompres...
                                    </>
                                ) : (
                                    <>Kompres PDF <span aria-hidden="true">↗</span></>
                                )}
                            </button>
                        )}

                        {status === "loading" && (
                            <div className="pdf-processing" role="status" aria-live="polite">
                                <span className="pdf-progress-track"><span /></span>
                                <div className="flex items-center justify-between gap-3">
                                    <span>Optimasi PDF sedang berjalan</span>
                                    <span>Mohon tunggu</span>
                                </div>
                            </div>
                        )}

                        {status === "error" && (
                            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
                        )}

                        {status === "done" && resultUrl && (
                            <div className="pdf-result-panel rounded-3xl border border-[#46745a]/25 bg-[#eaf1ec] p-6">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-stone-700">Hasil kompresi</p>
                                    <span className="pdf-done-mark" aria-label="Kompresi selesai">✓</span>
                                </div>
                                <p className="mt-2 text-2xl font-semibold">
                                    {formatBytes(file.size)} <span className="text-stone-400">→</span> {formatBytes(resultSize)}
                                </p>
                                <p className="mt-1 text-sm text-stone-600">
                                    {saved > 0
                                        ? `Ukuran berkurang ${saved}%.`
                                        : "File ini sudah cukup optimal, ukurannya tidak berubah."}
                                </p>
                                <div className="pdf-saved-track mt-4" aria-label={`Penghematan ukuran ${saved} persen`}>
                                    <span style={{ width: `${saved}%` }} />
                                </div>
                                <div className="mt-2 flex justify-between text-xs text-stone-500">
                                    <span>Ukuran awal: {formatBytes(file.size)}</span>
                                    <span>Hasil: {formatBytes(resultSize)}</span>
                                </div>
                                <div className="mt-5 flex flex-wrap gap-3">
                                    <a
                                        href={resultUrl}
                                        download={downloadName}
                                        className="pdf-download-button rounded-xl bg-[#46745a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#3b6350]"
                                    >
                                        Unduh PDF <span aria-hidden="true">↓</span>
                                    </a>
                                    <a
                                        href={resultUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                                    >
                                        Lihat PDF
                                    </a>
                                    <button
                                        onClick={() => {
                                            setResultUrl(null);
                                            setResultSize(0);
                                            setStatus("ready");
                                        }}
                                        className="rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-stone-50"
                                    >
                                        Coba tingkat lain
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </main>

            <footer className="mx-auto flex w-full max-w-6xl justify-between border-t border-black/10 px-6 py-6 text-xs text-stone-500">
                <span>remove-bg</span>
                <span>Simple image processing tool</span>
            </footer>
        </div>
    );
}