"use client";

/**
 * Promotional banner for Wilkinson Engineering's Trackside Aligner.
 * Styled like a Google Ads display ad — clearly labelled, dismissible.
 */
export function AdBanner() {
  return (
    <a
      href="https://wilkinson-engineering.de"
      target="_blank"
      rel="noopener noreferrer"
      className="
        group block relative overflow-hidden rounded-xl
        bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900
        border border-gray-700/50 hover:border-[#00d4aa]/40
        transition-all duration-300
      "
    >
      {/* Sponsored label */}
      <div className="absolute top-2 right-2 text-[9px] text-gray-500 uppercase tracking-widest z-10">
        Sponsored
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 px-5 py-4">
        {/* Left: Logo & brand */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#00d4aa]/10 border border-[#00d4aa]/20 flex items-center justify-center text-[#00d4aa] font-bold text-lg">
            W
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-bold text-white leading-none">
              Wilkinson Engineering
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              wilkinson-engineering.de
            </div>
          </div>
        </div>

        {/* Center: Message */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="text-sm font-semibold text-gray-100 leading-tight">
            Trackside Aligner&thinsp;&mdash;&thinsp;Precision Alignment, Engineered for Champions
          </div>
          <div className="text-xs text-gray-400 mt-1 leading-snug">
            Digital wheel alignment with 0.05° toe accuracy. &lt;2 min setup. Race-proven in 10+ series including GT Masters &amp; NLS.
          </div>
        </div>

        {/* Right: CTA */}
        <div className="flex-shrink-0">
          <span
            className="
              inline-block px-4 py-1.5 rounded-lg text-xs font-semibold
              bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30
              group-hover:bg-[#00d4aa]/25 transition-colors
            "
          >
            Learn More&thinsp;→
          </span>
        </div>
      </div>
    </a>
  );
}
