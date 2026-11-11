"use client";

import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { createZip, type ZipEntry } from "@/lib/create-zip";
import styles from "./workflow.module.css";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const FORMATS = [
  { value: "png", label: "PNG", mime: "image/png" },
  { value: "jpg", label: "JPG", mime: "image/jpeg" },
  { value: "webp", label: "WEBP", mime: "image/webp" },
  { value: "bmp", label: "BMP", mime: "image/bmp" },
  { value: "tiff", label: "TIFF", mime: "image/tiff" },
] as const;

type OutputFormat = (typeof FORMATS)[number]["value"];
type RemovalMode = "ai" | "signature";
type ItemStatus = "queued" | "processing" | "done" | "error";
type JobPhase = "idle" | "processing" | "done" | "partial" | "cancelled" | "error";

type WorkflowItem = {
  id: string;
  file: File;
  status: ItemStatus;
  outputName?: string;
  outputBytes?: number;
  error?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function baseName(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

function safeBaseName(filename: string) {
  return baseName(filename)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/[.\s]+$/g, "")
    .slice(0, 90) || "image";
}

function uniqueFilename(filename: string, usedNames: Set<string>) {
  const dotIndex = filename.lastIndexOf(".");
  const name = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const extension = dotIndex > 0 ? filename.slice(dotIndex) : "";
  let candidate = filename;
  let counter = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${name}-${counter}${extension}`;
    counter += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return typeof body?.detail === "string" ? body.detail : fallback;
}

export default function WorkflowPage() {
  const [items, setItems] = useState<WorkflowItem[]>([]);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [removalMode, setRemovalMode] = useState<RemovalMode>("ai");
  const [sensitivity, setSensitivity] = useState(18);
  const [convertOutput, setConvertOutput] = useState(true);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("png");
  const [quality, setQuality] = useState(88);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [phase, setPhase] = useState<JobPhase>("idle");
  const [notice, setNotice] = useState("");
  const [archiveUrl, setArchiveUrl] = useState<string | null>(null);
  const [archiveBytes, setArchiveBytes] = useState(0);
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    currentFile: "",
  });
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (archiveUrl) URL.revokeObjectURL(archiveUrl);
    };
  }, [archiveUrl]);

  useEffect(() => {
    return () => requestControllerRef.current?.abort();
  }, []);

  const addFiles = (incomingFiles: File[]) => {
    if (phase === "processing") return;

    const nextItems = [...items];
    const knownFiles = new Set(
      items.map((item) => `${item.file.name}|${item.file.size}|${item.file.lastModified}`),
    );
    const issues: string[] = [];

    for (const file of incomingFiles) {
      const extension = fileExtension(file.name);
      const supported =
        ALLOWED_MIME_TYPES.has(file.type) ||
        (!file.type && ALLOWED_EXTENSIONS.has(extension));

      if (!supported) {
        issues.push(`${file.name}: format tidak didukung.`);
        continue;
      }

      if (file.size > MAX_BYTES) {
        issues.push(`${file.name}: ukuran melebihi 10 MB.`);
        continue;
      }

      const key = `${file.name}|${file.size}|${file.lastModified}`;
      if (knownFiles.has(key)) continue;

      if (nextItems.length >= MAX_FILES) {
        issues.push(`Maksimal ${MAX_FILES} gambar dalam satu workflow.`);
        break;
      }

      knownFiles.add(key);
      nextItems.push({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        status: "queued",
      });
    }

    setItems(nextItems);
    setArchiveUrl(null);
    setArchiveBytes(0);
    setPhase("idle");
    setProgress({ completed: 0, total: 0, currentFile: "" });
    setNotice(issues.join(" "));
  };

  const removeItem = (id: string) => {
    if (phase === "processing") return;
    setItems((current) => current.filter((item) => item.id !== id));
    setArchiveUrl(null);
    setArchiveBytes(0);
    setPhase("idle");
    setNotice("");
  };

  const clearQueue = () => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setItems([]);
    setArchiveUrl(null);
    setArchiveBytes(0);
    setProgress({ completed: 0, total: 0, currentFile: "" });
    setPhase("idle");
    setNotice("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const runWorkflow = async () => {
    if (items.length === 0 || (!removeBackground && !convertOutput)) return;

    const controller = new AbortController();
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;

    const selectedItems = [...items];
    const archiveEntries: ZipEntry[] = [];
    const usedNames = new Set<string>();
    let failedCount = 0;

    setArchiveUrl(null);
    setArchiveBytes(0);
    setNotice("");
    setPhase("processing");
    setProgress({
      completed: 0,
      total: selectedItems.length,
      currentFile: "",
    });
    setItems((current) =>
      current.map((item) => ({
        ...item,
        status: "queued",
        outputName: undefined,
        outputBytes: undefined,
        error: undefined,
      })),
    );

    try {
      for (let index = 0; index < selectedItems.length; index += 1) {
        if (controller.signal.aborted) break;

        const item = selectedItems[index];
        setProgress({
          completed: index,
          total: selectedItems.length,
          currentFile: item.file.name,
        });
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, status: "processing", error: undefined } : entry,
          ),
        );

        try {
          let outputBlob: Blob = item.file;
          let extension = fileExtension(item.file.name);

          if (removeBackground) {
            const form = new FormData();
            form.append("file", item.file);
            form.append("mode", removalMode);
            if (removalMode === "signature") {
              form.append("sensitivity", String(sensitivity));
            }

            const response = await fetch(`${API_URL}/remove-bg`, {
              method: "POST",
              body: form,
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error(await responseError(response, "Gagal menghapus background."));
            }

            outputBlob = await response.blob();
            if (outputBlob.size === 0 || outputBlob.type.split(";")[0] !== "image/png") {
              throw new Error("Server tidak mengembalikan PNG yang valid.");
            }
            extension = "png";
          }

          if (convertOutput) {
            const conversionInput = removeBackground
              ? new File([outputBlob], `${safeBaseName(item.file.name)}.png`, { type: "image/png" })
              : item.file;
            const form = new FormData();
            form.append("file", conversionInput);
            form.append("output_format", outputFormat);
            form.append("quality", String(quality));
            form.append("background_color", backgroundColor);

            const response = await fetch(`${API_URL}/convert-image`, {
              method: "POST",
              body: form,
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error(await responseError(response, "Gagal mengonversi gambar."));
            }

            outputBlob = await response.blob();
            const expectedMime = FORMATS.find((format) => format.value === outputFormat)?.mime;
            if (
              outputBlob.size === 0 ||
              !expectedMime ||
              outputBlob.type.split(";")[0] !== expectedMime
            ) {
              throw new Error("Server tidak mengembalikan format gambar yang sesuai.");
            }
            extension = outputFormat === "jpg" ? "jpg" : outputFormat;
          }

          const suffix =
            removeBackground && convertOutput
              ? "-processed"
              : removeBackground
                ? "-no-bg"
                : "-converted";
          const filename = uniqueFilename(
            `${safeBaseName(item.file.name)}${suffix}.${extension}`,
            usedNames,
          );
          archiveEntries.push({
            name: filename,
            data: new Uint8Array(await outputBlob.arrayBuffer()),
          });

          setItems((current) =>
            current.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    status: "done",
                    outputName: filename,
                    outputBytes: outputBlob.size,
                    error: undefined,
                  }
                : entry,
            ),
          );
        } catch (caught) {
          if (controller.signal.aborted) break;

          failedCount += 1;
          const message =
            caught instanceof TypeError
              ? "Tidak bisa terhubung ke backend."
              : caught instanceof Error
                ? caught.message
                : "Terjadi kesalahan saat memproses file.";

          setItems((current) =>
            current.map((entry) =>
              entry.id === item.id ? { ...entry, status: "error", error: message } : entry,
            ),
          );
        }

        setProgress({
          completed: index + 1,
          total: selectedItems.length,
          currentFile: "",
        });
      }

      if (controller.signal.aborted) {
        setPhase("cancelled");
        setNotice("Workflow dibatalkan. Hasil yang sudah selesai belum dikemas menjadi ZIP.");
        return;
      }

      if (archiveEntries.length === 0) {
        setPhase("error");
        setNotice("Tidak ada file yang berhasil diproses. Periksa pesan error pada antrean.");
        return;
      }

      const archive = createZip(archiveEntries);
      setArchiveUrl(URL.createObjectURL(archive));
      setArchiveBytes(archive.size);
      setPhase(failedCount > 0 ? "partial" : "done");
      setProgress({
        completed: selectedItems.length,
        total: selectedItems.length,
        currentFile: "",
      });
    } catch (caught) {
      setPhase("error");
      setNotice(caught instanceof Error ? caught.message : "Gagal membuat arsip ZIP.");
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    }
  };

  const cancelWorkflow = () => {
    requestControllerRef.current?.abort();
    setNotice("Permintaan pembatalan dikirim...");
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files ?? []));
  };

  const isBusy = phase === "processing";
  const hasQuality = outputFormat === "jpg" || outputFormat === "webp";
  const hasBackgroundColor = outputFormat === "jpg" || outputFormat === "bmp";
  const canRun = items.length > 0 && (removeBackground || convertOutput) && !isBusy;
  const statusLabel =
    phase === "processing"
      ? "Sedang berjalan"
      : phase === "done"
        ? "Selesai"
        : phase === "partial"
          ? "Selesai sebagian"
          : phase === "error"
            ? "Perlu diperiksa"
            : phase === "cancelled"
              ? "Dibatalkan"
              : "Siap";

  return (
    <main className={`workspace-shell ${styles.workflowPage}`}>
      <SiteHeader />

      <div className="workspace-main workflow-main">
        <header className="tool-topbar">
          <div>
            <h1 className="tool-topbar-title">One-Click Workflow</h1>
            <p className="workflow-topbar-caption">Proses beberapa gambar dalam satu rangkaian.</p>
          </div>
          <span className="tool-topbar-meta">{statusLabel}</span>
        </header>

        <div className="workflow-layout">
          <section className="workspace-panel workflow-files-panel">
            <div className="workflow-panel-heading">
              <div>
                <span className="workflow-eyebrow">01 / FILE INPUT</span>
                <h2 className="workflow-panel-title">Antrean gambar</h2>
              </div>
              <span className="workflow-count">{items.length} / {MAX_FILES}</span>
            </div>

            <div
              className={`workflow-dropzone ${dragging ? "is-dragging" : ""} ${isBusy ? "is-disabled" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                if (!isBusy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => {
                if (!isBusy) inputRef.current?.click();
              }}
              onKeyDown={(event) => {
                if (!isBusy && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={isBusy ? -1 : 0}
              aria-label="Tambahkan gambar ke antrean"
              aria-disabled={isBusy}
            >
              <span className="workflow-upload-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
                  <path d="M4 15.5v3A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-3" />
                </svg>
              </span>
              <strong>{dragging ? "Lepaskan gambar di sini" : "Tarik gambar ke area ini"}</strong>
              <span>atau klik untuk memilih beberapa file</span>
              <div className="workflow-format-hints">
                <span>JPG</span><span>PNG</span><span>WEBP</span><span>Maks. 10 MB / file</span>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="hidden"
                disabled={isBusy}
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.currentTarget.value = "";
                }}
              />
            </div>

            {notice && <div className="workflow-notice" role="status">{notice}</div>}

            <div className="workflow-queue-toolbar">
              <span>{items.length === 0 ? "Belum ada file dipilih" : "File siap diproses"}</span>
              <button type="button" onClick={clearQueue} disabled={items.length === 0 || isBusy}>
                Bersihkan
              </button>
            </div>

            {items.length > 0 ? (
              <div className="workflow-file-list">
                {items.map((item, index) => (
                  <div className="workflow-file-row" key={item.id}>
                    <span className="workflow-file-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="workflow-file-type">IMG</span>
                    <div className="workflow-file-details">
                      <strong title={item.file.name}>{item.file.name}</strong>
                      <span>
                        {formatBytes(item.file.size)}
                        {item.outputBytes !== undefined ? ` · Hasil ${formatBytes(item.outputBytes)}` : ""}
                      </span>
                      {item.error && <small>{item.error}</small>}
                      {item.outputName && <small className="workflow-output-name">{item.outputName}</small>}
                    </div>
                    <span className={`workflow-item-status is-${item.status}`}>
                      {item.status === "queued"
                        ? "Antre"
                        : item.status === "processing"
                          ? "Proses"
                          : item.status === "done"
                            ? "Selesai"
                            : "Gagal"}
                    </span>
                    <button
                      type="button"
                      className="workflow-remove-file"
                      aria-label={`Hapus ${item.file.name} dari antrean`}
                      disabled={isBusy}
                      onClick={() => removeItem(item.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="workflow-empty-queue">
                <span>—</span>
                <p>File yang dipilih akan tampil di sini.</p>
              </div>
            )}
          </section>

          <div className="workflow-side-column">
            <section className="workspace-panel workflow-settings-panel">
              <div className="workflow-panel-heading">
                <div>
                  <span className="workflow-eyebrow">02 / PROCESS</span>
                  <h2 className="workflow-panel-title">Rangkaian proses</h2>
                </div>
                <span className="workflow-step-count">2 langkah</span>
              </div>

              <div className={`workflow-step-card ${removeBackground ? "is-enabled" : ""}`}>
                <div className="workflow-step-leading">
                  <span className="workflow-step-number">01</span>
                  <span className="workflow-step-symbol">✦</span>
                </div>
                <div className="workflow-step-content">
                  <label className="workflow-toggle-row">
                    <input
                      type="checkbox"
                      checked={removeBackground}
                      disabled={isBusy}
                      onChange={(event) => setRemoveBackground(event.target.checked)}
                    />
                    <span>
                      <strong>Hapus background</strong>
                      <small>Pisahkan objek dari latar gambar.</small>
                    </span>
                  </label>
                  {removeBackground && (
                    <div className="workflow-step-options">
                      <div className="workflow-segmented" role="group" aria-label="Metode penghapusan background">
                        <button
                          type="button"
                          disabled={isBusy}
                          className={removalMode === "ai" ? "is-selected" : ""}
                          onClick={() => setRemovalMode("ai")}
                        >
                          AI / U2Net
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          className={removalMode === "signature" ? "is-selected" : ""}
                          onClick={() => setRemovalMode("signature")}
                        >
                          Signature
                        </button>
                      </div>
                      {removalMode === "signature" && (
                        <div className="workflow-range-setting">
                          <div><label htmlFor="workflow-sensitivity">Sensitivitas</label><strong>{sensitivity}/100</strong></div>
                          <input
                            id="workflow-sensitivity"
                            type="range"
                            min="0"
                            max="100"
                            value={sensitivity}
                            disabled={isBusy}
                            onChange={(event) => setSensitivity(Number(event.target.value))}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="workflow-step-connector" />

              <div className={`workflow-step-card ${convertOutput ? "is-enabled" : ""}`}>
                <div className="workflow-step-leading">
                  <span className="workflow-step-number">02</span>
                  <span className="workflow-step-symbol">⇄</span>
                </div>
                <div className="workflow-step-content">
                  <label className="workflow-toggle-row">
                    <input
                      type="checkbox"
                      checked={convertOutput}
                      disabled={isBusy}
                      onChange={(event) => setConvertOutput(event.target.checked)}
                    />
                    <span>
                      <strong>Konversi format</strong>
                      <small>Ubah hasil ke format file pilihan.</small>
                    </span>
                  </label>
                  {convertOutput && (
                    <div className="workflow-step-options">
                      <label className="workflow-field-label" htmlFor="workflow-format">Format hasil</label>
                      <select
                        id="workflow-format"
                        value={outputFormat}
                        disabled={isBusy}
                        onChange={(event) => setOutputFormat(event.target.value as OutputFormat)}
                      >
                        {FORMATS.map((format) => (
                          <option key={format.value} value={format.value}>{format.label}</option>
                        ))}
                      </select>

                      {hasQuality && (
                        <div className="workflow-range-setting">
                          <div><label htmlFor="workflow-quality">Kualitas</label><strong>{quality}%</strong></div>
                          <input
                            id="workflow-quality"
                            type="range"
                            min="1"
                            max="100"
                            value={quality}
                            disabled={isBusy}
                            onChange={(event) => setQuality(Number(event.target.value))}
                          />
                        </div>
                      )}

                      {hasBackgroundColor && (
                        <div className="workflow-color-setting">
                          <label htmlFor="workflow-background">Warna latar untuk area transparan</label>
                          <div>
                            <input
                              id="workflow-background"
                              type="color"
                              value={backgroundColor}
                              disabled={isBusy}
                              onChange={(event) => setBackgroundColor(event.target.value)}
                            />
                            <code>{backgroundColor.toUpperCase()}</code>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {!removeBackground && !convertOutput && (
                <div className="workflow-warning" role="alert">
                  Aktifkan minimal satu langkah pemrosesan.
                </div>
              )}

              <div className="workflow-action-area">
                {isBusy ? (
                  <button type="button" className="action-secondary workflow-run-button" onClick={cancelWorkflow}>
                    Batalkan proses
                  </button>
                ) : (
                  <button type="button" className="action-primary workflow-run-button" onClick={runWorkflow} disabled={!canRun}>
                    <span>Jalankan Workflow</span>
                    <span aria-hidden="true">→</span>
                  </button>
                )}
                <p>Diproses satu per satu agar penggunaan resource backend tetap terkendali.</p>
              </div>
            </section>

            <section className="workspace-panel workflow-result-panel">
              <div className="workflow-panel-heading">
                <div>
                  <span className="workflow-eyebrow">03 / OUTPUT</span>
                  <h2 className="workflow-panel-title">Hasil workflow</h2>
                </div>
                {archiveUrl && <span className="workflow-ready-indicator">ZIP siap</span>}
              </div>

              {isBusy ? (
                <div className="workflow-progress">
                  <div className="workflow-progress-copy">
                    <strong>Memproses gambar</strong>
                    <span>{progress.completed} dari {progress.total}</span>
                  </div>
                  <div className="workflow-progress-track">
                    <span style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }} />
                  </div>
                  <p>{progress.currentFile ? `Sedang mengolah: ${progress.currentFile}` : "Menyiapkan antrean..."}</p>
                </div>
              ) : archiveUrl ? (
                <div className="workflow-download-card">
                  <span className="workflow-download-icon">ZIP</span>
                  <div>
                    <strong>workflow-results.zip</strong>
                    <span>{formatBytes(archiveBytes)} · Hasil berhasil dikemas</span>
                  </div>
                  <a href={archiveUrl} download="workflow-results.zip" className="action-primary workflow-download-button">
                    Download ZIP
                  </a>
                  {phase === "partial" && <small>Beberapa file gagal diproses. Periksa status pada antrean.</small>}
                </div>
              ) : phase === "cancelled" ? (
                <div className="workflow-result-empty">
                  <strong>Proses dibatalkan</strong>
                  <span>Tambahkan ulang atau jalankan workflow kembali.</span>
                </div>
              ) : phase === "error" ? (
                <div className="workflow-result-empty is-error">
                  <strong>Workflow belum selesai</strong>
                  <span>Periksa antrean file dan koneksi backend.</span>
                </div>
              ) : (
                <div className="workflow-result-empty">
                  <strong>Belum ada hasil</strong>
                  <span>Hasil ZIP akan tersedia setelah workflow selesai.</span>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
