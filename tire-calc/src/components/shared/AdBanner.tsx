"use client";

import Image from "next/image";

/**
 * Promotional banner for Wilkinson Engineering's Trackside Aligner.
 * Styled like a Google Ads display ad — clearly labelled.
 */
export function AdBanner() {
  return (
    <a
      href="https://wilkinson-engineering.de"
      target="_blank"
      rel="noopener noreferrer"
      className="
        group block relative overflow-hidden rounded-xl
        border border-gray-700/50 hover:border-[#00d4aa]/40
        transition-all duration-300 h-36 sm:h-40
      "
    >
      {/* Background banner — centered vertically, never stretched */}
      <Image
        src="/tire_calculator/we-banner.jpg"
        alt=""
        fill
        className="object-cover object-center pointer-events-none"
        priority={false}
      />

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-gray-950/90 via-gray-950/70 to-gray-950/50" />

      {/* Sponsored label */}
      <div className="absolute top-2 right-2 text-[9px] text-gray-400 uppercase tracking-widest z-10">
        Sponsored
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 px-4 sm:px-5 h-full justify-center">
        {/* Left: Logo icon */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <Image
            src="/tire_calculator/icon-512.png"
            alt="Wilkinson Engineering"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <div className="hidden sm:block">
            <div className="text-xs font-bold text-white leading-none">
              Wilkinson Engineering
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              wilkinson-engineering.de
            </div>
          </div>
        </div>

        {/* Center: Message */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="text-sm font-semibold text-gray-100 leading-tight">
            Trackside Aligner&thinsp;&mdash;&thinsp;Precision Alignment, Engineered for Champions
          </div>
          <div className="text-xs text-gray-300 mt-1 leading-snug hidden sm:block">
            Digital wheel alignment with 0.05° toe accuracy. &lt;2 min setup. Race-proven in 10+ series.
          </div>
        </div>

        {/* Right: CTA */}
        <div className="flex-shrink-0">
          <span
            className="
              inline-block px-4 py-1.5 rounded-lg text-xs font-semibold
              bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30
              group-hover:bg-[#00d4aa]/25 transition-colors
              backdrop-blur-sm
            "
          >
            Learn More&thinsp;→
          </span>
        </div>
      </div>
    </a>
  );
}
