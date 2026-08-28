"use client";

import OperationPageShell from "../OperationPageShell";
import OperationStatusListView from "../OperationStatusListView";

export default function CompletedOperationsPage() {
  return (
    <OperationPageShell>
      <OperationStatusListView
        status="COMPLETED"
        title="Operation — Completed"
        emptyMessage="No completed operations yet."
      />
    </OperationPageShell>
  );
}
