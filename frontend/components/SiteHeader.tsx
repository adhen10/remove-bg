"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
    {
        label: "IMAGE TOOLS",
        items: [
            {
                href: "/workflow",
                label: "Background Remover",
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
                label: "Signature Remover",
                icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 17c3.5 0 3.5-9 7-9 2.8 0 1.3 8 4 8 1.5 0 2.4-3 5-3" />
                        <path d="M4 20h16" />
                    </svg>
                ),
            },
            {
                href: "/image-converter",
                label: "Image Converter",
                icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7h12M13 4l3 3-3 3M20 17H8m3-3-3 3 3 3" />
                    </svg>
                ),
            },
        ],
    },
    {
        label: "PDF TOOLS",
        items: [
            {
                href: "/pdf-tools",
                label: "PDF Toolkit",
                icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 3.5h7l4 4v13H7z" />
                        <path d="M14 3.5v4h4M10 12h5M10 15.5h5" />
                    </svg>
                ),
            },
            {
                href: "/compress-pdf",
                label: "Compress PDF",
                icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 3.5h7l4 4v13H7z" />
                        <path d="M14 3.5v4h4M9.5 13h5M12 10.5v5" />
                    </svg>
                ),
            },
        ],
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

            <div className="app-sidebar-label">WORKSPACE</div>
            <nav aria-label="Feature navigation" className="app-sidebar-nav">
                {GROUPS.map((group) => (
                    <section className="app-sidebar-group" key={group.label} aria-label={group.label}>
                        <h2 className="app-sidebar-group-title">{group.label}</h2>
                        <div className="app-sidebar-group-links">
                            {group.items.map((item) => {
                                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        aria-current={active ? "page" : undefined}
                                        className={`app-sidebar-link ${active ? "is-active" : ""}`}
                                    >
                                        <span className="app-sidebar-icon">{item.icon}</span>
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </nav>

            <div className="app-sidebar-bottom">
                <span className="app-sidebar-dot" />
                <span>Personal workspace</span>
            </div>
        </aside>
    );
}
