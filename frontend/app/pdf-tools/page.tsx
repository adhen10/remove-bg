import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const TOOLS = [
    { number: "01", title: "Merge PDF", description: "Gabungkan beberapa dokumen PDF menjadi satu file.", href: "/pdf-tools/merge", available: true },
    { number: "02", title: "Split & Extract PDF", description: "Pisahkan dokumen atau ambil halaman yang dibutuhkan.", href: "/pdf-tools/split", available: true },
    { number: "03", title: "Rotate PDF", description: "Putar seluruh dokumen atau halaman tertentu.", href: "/pdf-tools/rotate", available: true },
    { number: "04", title: "Organize PDF", description: "Atur urutan halaman dan hapus halaman yang tidak diperlukan.", href: "/pdf-tools/organize", available: true },
    { number: "05", title: "Page Number", description: "Tambahkan nomor halaman dengan posisi dan format yang dapat diatur.", href: "/pdf-tools/page-number", available: true },
    { number: "06", title: "Compress PDF", description: "Kurangi ukuran file PDF dengan beberapa tingkat kompresi.", href: "/compress-pdf", available: true },
];

export default function PdfToolsPage() {
    return (
        <main className="workspace-shell">
            <SiteHeader />
            <div className="workspace-main">
                <header className="tool-topbar"><h1 className="tool-topbar-title">PDF Toolkit</h1></header>
                <section className="workspace-panel">
                    <div className="panel-heading"><div><h2 className="panel-title">Semua alat PDF</h2><p className="mt-1 text-sm text-[#879189]">Pilih alat untuk mengolah dokumen PDF.</p></div></div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {TOOLS.map((tool) => {
                            const content = <>
                                <div className="flex items-start justify-between gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f1f5f1] text-xs font-bold text-[#66806d]">{tool.number}</span>
                                    <span className={tool.available ? "rounded-full bg-[#e7f2e8] px-2.5 py-1 text-[10px] font-semibold text-[#397653]" : "rounded-full border border-[#e8ece7] px-2.5 py-1 text-[10px] font-medium text-[#929b94]"}>{tool.available ? "Tersedia" : "Dalam pengembangan"}</span>
                                </div>
                                <h3 className="mt-4 text-sm font-semibold text-[#29362e]">{tool.title}</h3>
                                <p className="mt-1 text-xs leading-5 text-[#7d8780]">{tool.description}</p>
                                <span className={tool.available ? "mt-4 inline-flex text-xs font-semibold text-[#397653]" : "mt-4 inline-flex text-xs font-medium text-[#9aa39c]"}>{tool.available ? "Buka alat →" : "Segera tersedia"}</span>
                            </>;
                            return tool.href ? <Link key={tool.number} href={tool.href} className="rounded-xl border border-[#dce8dd] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#9bb9a0] hover:shadow-sm">{content}</Link> : <article key={tool.number} className="rounded-xl border border-[#e4e8e3] bg-white p-4">{content}</article>;
                        })}
                    </div>
                </section>
            </div>
        </main>
    );
}
