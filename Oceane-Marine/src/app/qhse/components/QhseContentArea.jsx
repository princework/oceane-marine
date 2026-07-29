"use client";

import { useQhseSidebar } from "../QhseSidebarContext";

/**
 * Wrapper for QHSE page content that shifts when sidebar is open/closed (Operations-style).
 * Use this when you don't want to call useQhseSidebar in every page.
 */
export default function QhseContentArea({ children, className = "", ...rest }) {
  const { contentClassName } = useQhseSidebar();
  return (
    <div className={`${contentClassName} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
