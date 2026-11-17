import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const TOOLS = [
    {
        number: "01",
        title: "Merge PDF",
        description: "Gabungkan beberapa dokumen PDF menjadi satu file.",
        status: "Dalam pengembangan",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3.5h8l4 4v13H8z" /><path d="M16 3.5v4h4M4 7v13h11M11 12h6M14 9l3 3-3 3" />
            </svg>
        ),
    },
    {
        number: "02",
        title: "Split & Extract PDF",
        description: "Pisahkan dokumen atau ambil halaman yang dibutuhkan.",
        status: "Dalam pengembangan",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 3.5h12v17H6zM9 8h6M9 12h6M9 16h2" /><path d="m15 14 3 3-3 3" />
            </svg>
        ),
    },
    {
        number: "03",
        title: "Rotate PDF",
        description: "Putar seluruh dokumen atau halaman tertentu.",
        status: "Dalam pengembangan",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 9a7 7 0 0 1 11.5-2L20 12M4 12l2.4 5a7 7 0 0 0 11.5-2" />
            </svg>
        ),
    },
    {
        number: "04",
        title: "Organize PDF",
        description: "Atur urutan halaman dan hapus halaman yang tidak diperlukan.",
        status: "Dalam pengembangan",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4" y="4" width="6" height="7" rx="1" /><rect x="14" y="4" width="6" height="7" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 15h6M14 18h6" />
            </svg>
        ),
    },
];

export default function PdfToolsPage() {
    return (
        <main className="workspace-shell">
            <SiteHeader />
            <div className="workspace-main">
                <header className="tool-topbar">
                    <h1 className="tool-topbar-title">PDF Toolkit</h1>
                </header>

                <section className="workspace-panel">
                    <div className="panel-heading">
                        <div>
                            <h2 className="panel-title">Pengolahan dokumen PDF</h2>
                            <p className="text-sm text-[#879189] mt-1">Pilih operasi yang ingin dilakukan pada dokumen.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        <Link href="/compress-pdf" className="group rounded-xl border border-[#dce8dd] bg-[#f8fbf8] p-4 transition hover:-translate-y-0.5 hover:border-[#9bb9a0] hover:shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8f1e9] text-[#397653] [&_svg]:h-5 [&_svg]:w-5">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M7 3.5h10v17H7zM10 8h4M10 12h4M10 16h4M4 7v13h3M17 7h3v13h-3" />
                                    </svg>
                                </span>
                                <span className="rounded-full bg-[#e7f2e8] px-2.5 py-1 text-[10px] font-semibold text-[#397653]">Tersedia</span>
                            </div>
                            <h3 className="mt-4 text-sm font-semibold text-[#29362e]">Compress PDF</h3>
                            <p className="mt-1 text-xs leading-5 text-[#7d8780]">Kurangi ukuran file PDF dengan beberapa tingkat kompresi.</p>
                            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#397653]">Buka alat <span aria-hidden="true">→</span></span>
                        </Link>

                        {TOOLS.map((tool) => (
                            <article key={tool.number} className="rounded-xl border border-[#e4e8e3] bg-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f1f5f1] text-[#66806d] [&_svg]:h-5 [&_svg]:w-5">
                                        {tool.icon}
                                    </span>
                                    <span className="rounded-full border border-[#e8ece7] px-2.5 py-1 text-[10px] font-medium text-[#929b94]">{tool.status}</span>
                                </div>
                                <h3 className="mt-4 text-sm font-semibold text-[#29362e]">{tool.title}</h3>
                                <p className="mt-1 text-xs leading-5 text-[#7d8780]">{tool.description}</p>
                                <span className="mt-4 inline-flex text-xs font-medium text-[#9aa39c]">Segera tersedia</span>
                            </article>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
