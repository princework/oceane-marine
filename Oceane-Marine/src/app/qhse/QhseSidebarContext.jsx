"use client";

import { createContext, useContext, useState, useEffect } from "react";

const QhseSidebarContext = createContext({
  isSidebarOpen: true,
  setIsSidebarOpen: () => {},
});

export function QhseSidebarProvider({ children }) {
  const [isSidebarOpen, setIsSidebarOpenState] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("qhse-sidebar-open");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("qhse-sidebar-open", String(isSidebarOpen));
    }
  }, [isSidebarOpen]);

  const setIsSidebarOpen = (value) => {
    setIsSidebarOpenState(value);
  };

  return (
    <QhseSidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
      {children}
    </QhseSidebarContext.Provider>
  );
}

export function useQhseSidebar() {
  const context = useContext(QhseSidebarContext);
  const isSidebarOpen = context?.isSidebarOpen ?? true;
  const setIsSidebarOpen = context?.setIsSidebarOpen ?? (() => {});

  const contentClassName = `flex-1 min-w-0 w-full transition-all duration-300 ${
    isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"
  }`;

  return { isSidebarOpen, setIsSidebarOpen, contentClassName };
}
