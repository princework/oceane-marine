"use client";
import Link from "next/link";

export default function GoToDashBoardButton({
  href = "/dashboard",
  label = "← Dashboard",
  className = "",
  offsetLeftPx = 316, // sidebar width (300) + gap (16)
  offsetTopPx = 10, // small gap from top to avoid overlap
  /** When set, use this class for left position instead of offsetLeftPx (e.g. to align with centered content) */
  leftClassName = "",
}) {
  const style = leftClassName
    ? { top: offsetTopPx }
    : { left: offsetLeftPx, top: offsetTopPx };
  return (
    <Link
      href={href}
      style={style}
      className={`absolute z-[60] inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2
                  rounded-lg sm:rounded-xl border border-white/20 bg-white/10 hover:bg-white/15
                  text-white text-xs sm:text-sm font-semibold shadow-lg shadow-black/25
                  backdrop-blur-md transition duration-200 hover:translate-y-[1px]
                  ${leftClassName}
                  ${className}`}
    >
      {label}
    </Link>
  );
}