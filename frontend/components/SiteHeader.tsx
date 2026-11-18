"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const GROUPS = [
    {
        id: "image",
        label: "IMAGE TOOLS",
        items: [
            { href: "/workflow", label: "Background Remover", icon: "image" },
            { href: "/signature-remover", label: "Signature Remover", icon: "signature" },
            { href: "/image-converter", label: "Image Converter", icon: "convert" },
        ],
    },
    {
        id: "pdf",
        label: "PDF TOOLKIT",
        items: [
            { href: "/pdf-tools", label: "PDF Toolkit", icon: "pdf" },
            { href: "/pdf-tools/merge", label: "Merge PDF", icon: "merge" },
            { href: "/pdf-tools/split", label: "Split & Extract PDF", icon: "split" },
            { href: "/pdf-tools/rotate", label: "Rotate PDF", icon: "rotate" },
            { href: "/pdf-tools#organize-pdf", label: "Organize PDF", icon: "organize" },
            { href: "/pdf-tools#page-number", label: "Page Number", icon: "number" },
            { href: "/compress-pdf", label: "Compress PDF", icon: "compress" },
        ],
    },
];

function ToolIcon({ name }: { name: string }) {
    const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
    switch (name) {
        case "image": return <svg viewBox="0 0 24 24" {...common}><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="m4 15 4-4 3 3 3-5 6 7"/></svg>;
        case "signature": return <svg viewBox="0 0 24 24" {...common}><path d="M4 17c3.5 0 3.5-9 7-9 2.8 0 1.3 8 4 8 1.5 0 2.4-3 5-3M4 20h16"/></svg>;
        case "convert": return <svg viewBox="0 0 24 24" {...common}><path d="M4 7h12m-3-3 3 3-3 3M20 17H8m3-3-3 3 3 3"/></svg>;
        case "merge": return <svg viewBox="0 0 24 24" {...common}><path d="M7 3.5h7l4 4v13H7zM14 3.5v4h4M4 9v11h11M10 13h6m-3-3 3 3-3 3"/></svg>;
        case "split": return <svg viewBox="0 0 24 24" {...common}><path d="M6 3.5h12v17H6zM9 8h6M9 12h6M9 16h2m4-2 3 3-3 3"/></svg>;
        case "rotate": return <svg viewBox="0 0 24 24" {...common}><path d="M20 7v5h-5M4 17v-5h5M6.1 9a7 7 0 0 1 11.5-2L20 12M4 12l2.4 5a7 7 0 0 0 11.5-2"/></svg>;
        case "organize": return <svg viewBox="0 0 24 24" {...common}><rect x="4" y="4" width="6" height="7" rx="1"/><rect x="14" y="4" width="6" height="7" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 15h6M14 18h6"/></svg>;
        case "number": return <svg viewBox="0 0 24 24" {...common}><path d="M7 4 5 20M15 4l-2 16M3 9h16M2 15h16"/></svg>;
        default: return <svg viewBox="0 0 24 24" {...common}><path d="M7 3.5h10v17H7zM10 8h4M10 12h4M10 16h4"/></svg>;
    }
}

export default function SiteHeader() {
    const pathname = usePathname();
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        image: pathname === "/workflow" || pathname.startsWith("/signature-remover") || pathname.startsWith("/image-converter"),
        pdf: pathname.startsWith("/pdf-tools") || pathname.startsWith("/compress-pdf"),
    });

    return (
        <aside className="app-sidebar">
            <Link href="/workflow" className="app-sidebar-brand" aria-label="File Tools">
                <span className="app-sidebar-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7.5h16M4 12h11M4 16.5h7"/><path d="m16 13 4 3.5-4 3.5"/></svg></span>
                <span>File Tools</span>
            </Link>
            <div className="app-sidebar-label">WORKSPACE</div>
            <nav aria-label="Feature navigation" className="app-sidebar-nav">
                {GROUPS.map((group) => {
                    const isOpen = expanded[group.id];
                    return (
                        <section className={`app-sidebar-group ${isOpen ? "is-open" : ""}`} key={group.id}>
                            <button type="button" className="app-sidebar-group-toggle" aria-expanded={isOpen} onClick={() => setExpanded((current) => ({ ...current, [group.id]: !current[group.id] }))}>
                                <span>{group.label}</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
                            </button>
                            {isOpen && <div className="app-sidebar-group-links">
                                {group.items.map((item) => {
                                    const basePath = item.href.split("#")[0];
                                    const active = item.href === "/pdf-tools" ? pathname === "/pdf-tools" : pathname === basePath || pathname.startsWith(basePath + "/");
                                    return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`app-sidebar-link ${active ? "is-active" : ""}`}>
                                        <span className="app-sidebar-icon"><ToolIcon name={item.icon}/></span><span>{item.label}</span>
                                    </Link>;
                                })}
                            </div>}
                        </section>
                    );
                })}
            </nav>
            <div className="app-sidebar-bottom"><span className="app-sidebar-dot"/><span>Personal workspace</span></div>
        </aside>
    );
}
