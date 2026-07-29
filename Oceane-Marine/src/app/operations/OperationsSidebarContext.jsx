"use client";

import { createContext, useContext, useState, useEffect } from "react";

const OperationsSidebarContext = createContext({
  isSidebarOpen: true,
  setIsSidebarOpen: () => {},
});

export function OperationsSidebarProvider({ children }) {
  // Initialize from localStorage or default to true
  const [isSidebarOpen, setIsSidebarOpenState] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("operations-sidebar-open");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  // Update localStorage whenever sidebar state changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("operations-sidebar-open", String(isSidebarOpen));
    }
  }, [isSidebarOpen]);

  const setIsSidebarOpen = (value) => {
    setIsSidebarOpenState(value);
  };

  return (
    <OperationsSidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
      {children}
    </OperationsSidebarContext.Provider>
  );
}

export function useOperationsSidebar() {
  const context = useContext(OperationsSidebarContext);
  if (!context) {
    // Fallback for pages that don't use the context
    return { isSidebarOpen: true, setIsSidebarOpen: () => {} };
  }
  return context;
}
