"use client";

import { createContext, useContext, useState, useEffect } from "react";

const HrSidebarContext = createContext({
  isSidebarOpen: true,
  setIsSidebarOpen: () => {},
});

export function HrSidebarProvider({ children }) {
  const [isSidebarOpen, setIsSidebarOpenState] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hr-sidebar-open");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("hr-sidebar-open", String(isSidebarOpen));
    }
  }, [isSidebarOpen]);

  const setIsSidebarOpen = (value) => {
    setIsSidebarOpenState(value);
  };

  return (
    <HrSidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
      {children}
    </HrSidebarContext.Provider>
  );
}

export function useHrSidebar() {
  const context = useContext(HrSidebarContext);
  const isSidebarOpen = context?.isSidebarOpen ?? true;
  const setIsSidebarOpen = context?.setIsSidebarOpen ?? (() => {});

  const contentClassName = `flex-1 min-w-0 transition-all duration-300 ${
    isSidebarOpen ? "ml-0 md:ml-72" : "mx-auto max-w-7xl"
  }`;

  return { isSidebarOpen, setIsSidebarOpen, contentClassName };
}
