"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
    {
        href: "/",
        label: "Hapus background",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
                <path d="m4 15 4-4 3 3 3-5 6 7" />
            </svg>
        ),
    },
    {
        href: "/image-converter",
        label: "Image converter",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h10M11 4l3 3-3 3M20 17H10m3-3-3 3 3 3" />
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
    {
        href: "/workflow",
        label: "One-Click Workflow",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6h6l2 3h8M4 18h6l2-3h8" />
                <path d="m17 6 3 3-3 3M17 12l3 3-3 3" />
            </svg>
        ),
    },
];

export default function SiteHeader() {
    const pathname = usePathname();

    return (
        <aside className="app-sidebar">
            <Link href="/" className="app-sidebar-brand" aria-label="remove-bg">
                <span className="app-sidebar-mark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7.5h16M4 12h11M4 16.5h7" />
                        <path d="m16 13 4 3.5-4 3.5" />
                    </svg>
                </span>
                <span>remove-bg</span>
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
                <span>Workspace</span>
            </div>
        </aside>
    );
}
