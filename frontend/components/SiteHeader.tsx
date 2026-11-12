"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
    {
        href: "/workflow",
        label: "Pengolahan gambar",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
                <path d="m4 15 4-4 3 3 3-5 6 7" />
                <path d="M16.5 5.5v4M14.5 7.5h4" />
            </svg>
        ),
    },
    {
        href: "/signature-remover",
        label: "Tanda tangan / dokumen",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 17c3.5 0 3.5-9 7-9 2.8 0 1.3 8 4 8 1.5 0 2.4-3 5-3" />
                <path d="M4 20h16" />
            </svg>
        ),
    },
    {
        href: "/compress-pdf",
        label: "Kompres PDF",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 3.5h7l4 4v13H7z" />
                <path d="M14 3.5v4h4M10 12h5M10 15.5h5" />
            </svg>
        ),
    },
];

export default function SiteHeader() {
    const pathname = usePathname();

    return (
        <aside className="app-sidebar">
            <Link href="/workflow" className="app-sidebar-brand" aria-label="File Tools">
                <span className="app-sidebar-mark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7.5h16M4 12h11M4 16.5h7" />
                        <path d="m16 13 4 3.5-4 3.5" />
                    </svg>
                </span>
                <span>File Tools</span>
            </Link>

            <div className="app-sidebar-label">TOOLS</div>
            <nav aria-label="Tools" className="app-sidebar-nav">
                {TABS.map((tab, index) => {
                    const active = pathname === tab.href;
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            aria-current={active ? "page" : undefined}
                            className={`app-sidebar-link ${active ? "is-active" : ""}`}
                        >
                            <span className="app-sidebar-icon">{tab.icon}</span>
                            <span>{tab.label}</span>
                            <span className="app-sidebar-shortcut">{String(index + 1).padStart(2, "0")}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="app-sidebar-bottom">
                <span className="app-sidebar-dot" />
                <span>Personal workspace</span>
            </div>
        </aside>
    );
}
