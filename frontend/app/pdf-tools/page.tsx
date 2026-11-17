import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const TOOLS = [
    { id: "merge-pdf", number: "01", title: "Merge PDF", description: "Gabungkan beberapa dokumen PDF menjadi satu file." },
    { id: "split-pdf", number: "02", title: "Split & Extract PDF", description: "Pisahkan dokumen atau ambil halaman yang dibutuhkan." },
    { id: "rotate-pdf", number: "03", title: "Rotate PDF", description: "Putar seluruh dokumen atau halaman tertentu." },
    { id: "organize-pdf", number: "04", title: "Organize PDF", description: "Atur urutan halaman dan hapus halaman yang tidak diperlukan." },
    { id: "page-number", number: "05", title: "Page Number", description: "Tambahkan nomor halaman dengan format dan posisi yang dapat diatur." },
];

export default function PdfToolsPage() {
    return (
        <main className="workspace-shell">
            <SiteHeader />
            <div className="workspace-main">
                <header className="tool-topbar"><h1 className="tool-topbar-title">PDF Toolkit</h1></header>
                <section className="workspace-panel">
                    <div className="panel-heading">
                        <div><h2 className="panel-title">Semua alat PDF</h2><p className="text-sm text-[#879189] mt-1">Pilih alat untuk mengolah dokumen PDF.</p></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {TOOLS.map((tool) => (
                            <article id={tool.id} key={tool.id} className="scroll-mt-5 rounded-xl border border-[#e4e8e3] bg-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f1f5f1] text-[#66806d] text-xs font-bold">{tool.number}</span>
                                    <span className="rounded-full border border-[#e8ece7] px-2.5 py-1 text-[10px] font-medium text-[#929b94]">Dalam pengembangan</span>
                                </div>
                                <h3 className="mt-4 text-sm font-semibold text-[#29362e]">{tool.title}</h3>
                                <p className="mt-1 text-xs leading-5 text-[#7d8780]">{tool.description}</p>
                                <span className="mt-4 inline-flex text-xs font-medium text-[#9aa39c]">Segera tersedia</span>
                            </article>
                        ))}
                        <Link href="/compress-pdf" id="compress-pdf" className="scroll-mt-5 group rounded-xl border border-[#dce8dd] bg-[#f8fbf8] p-4 transition hover:-translate-y-0.5 hover:border-[#9bb9a0] hover:shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8f1e9] text-[#397653] text-xs font-bold">06</span>
                                <span className="rounded-full bg-[#e7f2e8] px-2.5 py-1 text-[10px] font-semibold text-[#397653]">Tersedia</span>
                            </div>
                            <h3 className="mt-4 text-sm font-semibold text-[#29362e]">Compress PDF</h3>
                            <p className="mt-1 text-xs leading-5 text-[#7d8780]">Kurangi ukuran file PDF dengan beberapa tingkat kompresi.</p>
                            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#397653]">Buka alat <span aria-hidden="true">→</span></span>
                        </Link>
                    </div>
                </section>
            </div>
        </main>
    );
}
