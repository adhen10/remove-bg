"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MAX_BYTES = 10 * 1024 * 1024;

const checkerboard = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
} as const;

type Status = "idle" | "loading" | "done" | "error";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Bersihkan object URL supaya tidak bocor memori
  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [originalUrl, resultUrl]);

  const process = useCallback(async (picked: File) => {
    if (!picked.type.startsWith("image/")) {
      setError("File harus berupa gambar (JPG, PNG, atau WebP).");
      setStatus("error");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError("Ukuran file maksimal 10 MB.");
      setStatus("error");
      return;
    }

    setFile(picked);
    setOriginalUrl(URL.createObjectURL(picked));
    setResultUrl(null);
    setError(null);
    setStatus("loading");

    try {
      const form = new FormData();
      form.append("file", picked);
      const res = await fetch(`${API_URL}/remove-bg`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? "Gagal memproses gambar.");
      }
      const blob = await res.blob();
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
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) process(dropped);
  };

  // Tempel gambar dari clipboard (Ctrl+V)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/")
      );
      const pasted = item?.getAsFile();
      if (pasted) process(pasted);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [process]);

  const reset = () => {
    setFile(null);
    setOriginalUrl(null);
    setResultUrl(null);
    setError(null);
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadName = file
    ? `${file.name.replace(/\.[^.]+$/, "")}-no-bg.png`
    : "no-bg.png";

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-5 py-12 text-stone-900">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Hapus background gambar
        </h1>
        <p className="mt-3 max-w-xl text-stone-600">
          Unggah foto, dapatkan PNG dengan background transparan. File diproses
          di server dan tidak disimpan.
        </p>
      </header>

      {status === "idle" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-20 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
            dragging
              ? "border-teal-700 bg-teal-50"
              : "border-stone-300 bg-white hover:border-stone-400"
          }`}
        >
          <p className="text-lg font-medium">Tarik gambar ke sini</p>
          <p className="mt-1 text-sm text-stone-500">
            atau klik untuk memilih file, atau tempel dengan Ctrl+V. JPG, PNG,
            WebP, maksimal 10 MB.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (picked) process(picked);
            }}
          />
        </div>
      )}

      {status !== "idle" && (
        <section>
          <div className="grid gap-4 sm:grid-cols-2">
            <figure>
              <figcaption className="mb-2 text-sm font-medium text-stone-600">
                Asli
              </figcaption>
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-stone-200">
                {originalUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={originalUrl}
                    alt="Gambar asli"
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>
            </figure>

            <figure>
              <figcaption className="mb-2 text-sm font-medium text-stone-600">
                Hasil
              </figcaption>
              <div
                style={checkerboard}
                className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl"
              >
                {status === "loading" && (
                  <div className="flex flex-col items-center gap-3 rounded-xl bg-white/90 px-5 py-4 text-sm">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-teal-700" />
                    Memproses, biasanya 2-5 detik
                  </div>
                )}
                {status === "done" && resultUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resultUrl}
                    alt="Gambar tanpa background"
                    className="max-h-full max-w-full object-contain"
                  />
                )}
                {status === "error" && (
                  <p className="max-w-xs rounded-xl bg-white/95 px-4 py-3 text-center text-sm text-red-700">
                    {error}
                  </p>
                )}
              </div>
            </figure>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {status === "done" && resultUrl && (
              <a
                href={resultUrl}
                download={downloadName}
                className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
              >
                Unduh PNG
              </a>
            )}
            {status === "error" && file && (
              <button
                onClick={() => process(file)}
                className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
              >
                Coba lagi
              </button>
            )}
            <button
              onClick={reset}
              className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium hover:bg-stone-50"
            >
              Gambar lain
            </button>
          </div>
        </section>
      )}
    </main>
  );
}