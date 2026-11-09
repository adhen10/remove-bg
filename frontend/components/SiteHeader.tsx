"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
    { href: "/", label: "Hapus background" },
    { href: "/compress-pdf", label: "Kompres PDF" },
];

export default function SiteHeader() {
    const pathname = usePathname();

    return (
        <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-b border-black/10 px-6 py-6">
            <Link href="/" className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#46745a] text-white">
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden="true"
                    >
                        <path d="M5 7h14M5 12h9M5 17h6" />
                    </svg>
                </span>
                <span className="text-base font-semibold tracking-tight text-stone-900">
                    remove-bg
                </span>
            </Link>

            <nav
                aria-label="Menu utama"
                className="flex gap-1 rounded-full border border-black/10 bg-white p-1"
            >
                {TABS.map((tab) => {
                    const active = pathname === tab.href;
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            aria-current={active ? "page" : undefined}
                            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#46745a] ${active
                                    ? "bg-[#46745a] text-white"
                                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                                }`}
                        >
                            {tab.label}
                        </Link>
                    );
                })}
            </nav>
        </header>
    );
}