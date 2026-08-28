"use client";

import { useState } from "react";
import OperationPageShell from "../OperationPageShell";
import OperationStatusListView from "../OperationStatusListView";
import StatusActionButton from "../StatusActionButton";

async function patchStatus(id, status) {
  const res = await fetch(`/api/operations/sts/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to update operation status");
  }
}

function CancelAction({ operation, refetch }) {
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    if (!confirm(`Cancel operation ${operation.Operation_Ref_No || ""}? This cannot be undone.`)) return;
    setLoading(true);
    try {
      await patchStatus(operation._id, "CANCELED");
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return <StatusActionButton label="Cancel" tone="red" onClick={handleCancel} loading={loading} />;
}

export default function LinedUpOperationsPage() {
  return (
    <OperationPageShell>
      <OperationStatusListView
        status="Lined Up"
        title="Operation — Lined Up"
        emptyMessage="No operations are currently lined up."
        extraRowActions={(operation, refetch) => (
          <CancelAction operation={operation} refetch={refetch} />
        )}
      />
    </OperationPageShell>
  );
}
