"use client";

import { useEffect } from "react";
import PropTypes from "prop-types";

export default function QHSEPage({ onStatsLoaded }) {
  useEffect(() => {
    let isMounted = true;

    const fetchNearMissStats = async () => {
      try {
        const res = await fetch("/api/dashboard/qhse/near-miss", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error("Failed to fetch stats");
        }

        if (isMounted && onStatsLoaded) {
          onStatsLoaded({
            total: data.data.total || 0,
            pending: data.data.underReview || 0,
            reviewed: data.data.reviewed || 0,
          });
        }
      } catch (err) {
        console.error("QHSEPage fetch error:", err);
        if (isMounted && onStatsLoaded) {
          onStatsLoaded({
            total: 0,
            pending: 0,
            reviewed: 0,
          });
        }
      }
    };

    fetchNearMissStats();
    return () => {
      isMounted = false;
    };
  }, [onStatsLoaded]);
  return null;
}

QHSEPage.propTypes = {
  onStatsLoaded: PropTypes.func.isRequired,
};

QHSEPage.propTypes = {
  onStatsLoaded: PropTypes.func.isRequired,
};
