"use client";

/**
 * Same orange ring full-screen loader as HR / QHSE / Operations module overlays (no loading text).
 */
export default function OrangeFullPageLoader() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-lg transition-opacity duration-300"
      role="status"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center justify-center animate-fade-in">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-orange-500/10 rounded-full" />
          <div
            className="absolute top-0 left-0 w-24 h-24 border-4 border-transparent border-t-orange-500 border-r-orange-500/50 rounded-full animate-spin"
            style={{ animationDuration: "1s" }}
          />
          <div
            className="absolute top-0 left-0 w-24 h-24 border-4 border-transparent border-b-orange-400 border-l-orange-400/50 rounded-full animate-spin"
            style={{ animationDuration: "1.5s", animationDirection: "reverse" }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-orange-500 rounded-full animate-pulse shadow-lg shadow-orange-500/50" />
        </div>
      </div>
    </div>
  );
}
