"use client";

import { useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";

type PdfFile = { id: string; file: File };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MergePdfPage() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<PdfFile[]>([]);
    const [dragging, setDragging] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    function addFiles(selected: FileList | File[]) {
        const incoming = Array.from(selected);
        const invalid = incoming.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
        if (invalid) {
            setError(`${invalid.name} bukan file PDF.`);
            return;
        }
        setError("");
        setSuccess("");
        setFiles((current) => {
            const next = [...current];
            for (const file of incoming) {
                if (!next.some((item) => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) {
                    next.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file });
                }
            }
            return next;
        });
    }

    function moveFile(index: number, direction: -1 | 1) {
        setFiles((current) => {
            const target = index + direction;
            if (target < 0 || target >= current.length) return current;
            const next = [...current];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    }

    async function merge() {
        if (files.length < 2) {
            setError("Tambahkan minimal 2 file PDF.");
            return;
        }
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            const form = new FormData();
            files.forEach(({ file }) => form.append("files", file));
            const response = await fetch(`${API_URL}/pdf-tools/merge`, { method: "POST", body: form });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.detail || "Gagal menggabungkan PDF.");
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "merged-document.pdf";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            setSuccess("PDF berhasil digabungkan dan unduhan dimulai.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan saat menggabungkan PDF.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="workspace-shell">
            <SiteHeader />
            <div className="workspace-main">
                <header className="tool-topbar">
                    <div><h1 className="tool-topbar-title">Merge PDF</h1></div>
                </header>
                <section className="workspace-panel pdf-tool-panel">
                    <div className="panel-heading"><div><h2 className="panel-title">Gabungkan dokumen PDF</h2></div></div>

                    <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }} className={`w-full rounded-xl border border-dashed p-8 text-center transition ${dragging ? "border-[#4c8a5d] bg-[#f0f7f0]" : "border-[#cbd9cc] bg-[#fbfdfb] hover:border-[#7fa989]"}`}>
                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#eaf3eb] text-xl text-[#397653]">＋</span>
                        <strong className="mt-3 block text-sm text-[#34463a]">Tarik PDF ke sini atau klik untuk memilih</strong>
                        <span className="mt-1 block text-xs text-[#929b94]">Pilih minimal 2 file · Maksimal total 200 MB</span>
                    </button>
                    <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />

                    <div className="mt-6 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-[#34463a]">Urutan dokumen <span className="text-[#8b988e]">({files.length})</span></h3><button type="button" onClick={() => { setFiles([]); setError(""); setSuccess(""); }} disabled={!files.length || busy} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#f0d9d6] bg-white px-3 text-xs font-semibold text-[#a34e45] hover:bg-[#fff7f6] disabled:opacity-40"><span aria-hidden="true">▤</span>Hapus semua</button></div>
                    {files.length ? <ol className="mt-3 grid gap-2">
                        {files.map(({ id, file }, index) => <li key={id} className="flex items-center gap-3 rounded-lg border border-[#e5ebe5] bg-white p-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f0f5f0] text-xs font-bold text-[#588064]">{index + 1}</span>
                            <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#405247]">{file.name}</strong><small className="text-[10px] text-[#929b94]">{formatSize(file.size)}</small></span>
                            <div className="flex items-center gap-1"><button type="button" aria-label="Naikkan urutan" title="Naikkan" onClick={() => moveFile(index, -1)} disabled={index === 0 || busy} className="rounded border px-2 py-1 text-xs disabled:opacity-30">↑</button><button type="button" aria-label="Turunkan urutan" title="Turunkan" onClick={() => moveFile(index, 1)} disabled={index === files.length - 1 || busy} className="rounded border px-2 py-1 text-xs disabled:opacity-30">↓</button><button type="button" aria-label="Hapus file" title="Hapus" onClick={() => setFiles((current) => current.filter((item) => item.id !== id))} disabled={busy} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#f0d9d6] px-2 text-[11px] font-semibold text-[#a34e45] hover:bg-[#fff7f6] disabled:opacity-30">Hapus</button></div>
                        </li>)}
                    </ol> : <div className="mt-3 rounded-lg border border-dashed border-[#e4e8e3] py-10 text-center text-xs text-[#9aa39c]">Belum ada dokumen dipilih.</div>}

                    {error && <p role="alert" className="mt-4 rounded-lg bg-[#fff4f2] p-3 text-xs text-[#a34e45]">{error}</p>}
                    {success && <p role="status" className="mt-4 rounded-lg bg-[#eff7ef] p-3 text-xs text-[#397653]">{success}</p>}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] text-[#929b94]">File diproses sementara dan tidak disimpan sebagai dokumen akun.</p><button type="button" onClick={merge} disabled={busy || files.length < 2} className="pdf-tool-button disabled:cursor-not-allowed">{busy ? "Menggabungkan..." : "Gabungkan PDF →"}</button></div>
                </section>
            </div>
        </main>
    );
}
