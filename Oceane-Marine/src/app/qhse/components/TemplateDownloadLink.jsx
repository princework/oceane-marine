"use client";

import { getQhseTemplatePath } from "../constants/templates";

const downloadIcon = (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
  </svg>
);

/**
 * Renders a Template download link for QHSE form/list/view pages.
 * @param {string} formCode - e.g. "QAF-OFD-004", "HSE-001A"
 * @param {string} [label="Template"] - Button/link text
 * @param {string} [className] - Additional classes for the anchor
 */
export function TemplateDownloadLink({ formCode, label = "Template", className = "" }) {
  const href = getQhseTemplatePath(formCode);
  if (!href) return null;
  const defaultClass = "inline-flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-500/20 transition flex-shrink-0";
  return (
    <a
      href={href}
      download
      className={className || defaultClass}
      title={`Download form template (${formCode})`}
      aria-label={`Download template: ${formCode}`}
    >
      {downloadIcon}
      {label}
    </a>
  );
}
