"use client";

import OperationPageShell from "../OperationPageShell";
import OperationStatusListView from "../OperationStatusListView";

export default function CancelledOperationsPage() {
  return (
    <OperationPageShell>
      <OperationStatusListView
        status="CANCELED"
        title="Operation — Cancelled"
        emptyMessage="No cancelled operations."
      />
    </OperationPageShell>
  );
}
