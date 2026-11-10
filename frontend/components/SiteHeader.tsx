"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
    {
        href: "/",
        label: "Hapus background",
        shortLabel: "Hapus BG",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 5.5h16v13H4z" />
                <path d="m4 15 4-4 3 3 3-5 6 7" />
            </svg>
        ),
    },
    {
        href: "/image-converter",
        label: "Konversi gambar",
        shortLabel: "Converter",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 7h10M11 4l3 3-3 3M20 17H10m3-3-3 3 3 3" />
            </svg>
        ),
    },
    {
        href: "/compress-pdf",
        label: "Kompres PDF",
        shortLabel: "Kompres PDF",
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
        <header className="site-header-bar">
            <div className="flex w-full items-center justify-between gap-5">
                <Link href="/" className="site-brand" aria-label="remove-bg, halaman utama">
                    <span className="site-brand-mark">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 7.5h16M4 12h11M4 16.5h7" />
                            <path d="m16 13 4 3.5-4 3.5" />
                        </svg>
                    </span>
                    <span className="site-brand-copy">
                        <span className="site-brand-name">remove-bg</span>
                        <span className="site-brand-caption">Creative utilities</span>
                    </span>
                </Link>

                <nav aria-label="Menu utama" className="site-tab-list flex items-center">
                    {TABS.map((tab) => {
                        const active = pathname === tab.href;
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                aria-current={active ? "page" : undefined}
                                className="site-tab"
                                title={tab.label}
                            >
                                {tab.icon}
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{tab.shortLabel}</span>
                            </Link>
                        );
                    })}
                </nav>

                <span className="site-header-status">
                    <i aria-hidden="true" />
                    Tools siap digunakan
                </span>
            </div>
        </header>
    );
}
