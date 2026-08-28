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

function InProgressActions({ operation, refetch }) {
  const [loadingAction, setLoadingAction] = useState(null); // "COMPLETED" | "CANCELED" | null

  const run = async (status, confirmMessage) => {
    if (!confirm(confirmMessage)) return;
    setLoadingAction(status);
    try {
      await patchStatus(operation._id, status);
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <>
      <StatusActionButton
        label="Mark Complete"
        tone="emerald"
        onClick={() =>
          run("COMPLETED", `Mark operation ${operation.Operation_Ref_No || ""} as completed?`)
        }
        loading={loadingAction === "COMPLETED"}
        disabled={loadingAction === "CANCELED"}
      />
      <StatusActionButton
        label="Cancel"
        tone="red"
        onClick={() =>
          run("CANCELED", `Cancel operation ${operation.Operation_Ref_No || ""}? This cannot be undone.`)
        }
        loading={loadingAction === "CANCELED"}
        disabled={loadingAction === "COMPLETED"}
      />
    </>
  );
}

export default function InProgressOperationsPage() {
  return (
    <OperationPageShell>
      <OperationStatusListView
        status="INPROGRESS"
        title="Operation — In Progress"
        emptyMessage="No operations are currently in progress."
        extraRowActions={(operation, refetch) => (
          <InProgressActions operation={operation} refetch={refetch} />
        )}
      />
    </OperationPageShell>
  );
}
