"use client";

import { createContext, useContext, useState, useCallback } from "react";

const QhseLoadingContext = createContext({
  pageLoading: false,
  setPageLoading: () => {},
});

export function QhseLoadingProvider({ children }) {
  const [pageLoading, setPageLoadingState] = useState(false);
  const setPageLoading = useCallback((value) => {
    setPageLoadingState(Boolean(value));
  }, []);
  return (
    <QhseLoadingContext.Provider value={{ pageLoading, setPageLoading }}>
      {children}
    </QhseLoadingContext.Provider>
  );
}

export function useQhseLoading() {
  return useContext(QhseLoadingContext);
}
