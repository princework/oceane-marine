"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readJsonFromResponse } from "@/lib/utils/readJsonFromResponse";

const ENDPOINT = "/api/operations/sts/sync-email";

function formatReceived(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Ops Team <ops@client.com>" → "Ops Team" */
function senderName(from) {
  const match = String(from || "").match(/^\s*"?([^"<]+?)"?\s*</);
  return (match ? match[1] : from || "").trim() || "(unknown sender)";
}

/**
 * Opens the operations mailbox, lets the operator pick a client nomination email,
 * and imports it into a draft STS operation for review.
 */
export default function ImportFromEmailButton({ className = "" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(ENDPOINT);
      const data = await readJsonFromResponse(response);
      if (!response.ok) throw new Error(data.error || "Could not read the operations mailbox.");
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the operations mailbox.");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadMessages();
  }, [open, loadMessages]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !importingId) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, importingId]);

  const importMessage = async (messageId) => {
    setImportingId(messageId);
    setError("");
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = await readJsonFromResponse(response);
      if (!response.ok) throw new Error(data.error || "Could not import this email.");

      setOpen(false);
      router.push(`/operations/sts-operations/new/edit/${data.operationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import this email.");
      setImportingId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Import an operation from a client email"
        className={`inline-flex items-center gap-2 rounded-xl border border-orange-400/30 bg-orange-500/20 px-3 py-2.5 text-sm font-semibold text-orange-200 transition hover:bg-orange-500/30 ${className}`}
      >
        <span aria-hidden="true">✉️</span>
        <span className="hidden sm:inline">Import from Email</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Import from email"
        >
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">Import from Email</h2>
                <p className="mt-0.5 text-xs text-white/50">
                  Client emails from the last 30 days with attachments. Importing creates a draft
                  operation for you to review — nothing is submitted.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={Boolean(importingId)}
                className="shrink-0 rounded-lg px-2 py-1 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label="Close"
              >
                ✕
              </button>
            </header>

            <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
              {error && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {error}
                </div>
              )}

              {loading && (
                <p className="py-8 text-center text-sm text-white/50">Reading the mailbox…</p>
              )}

              {!loading && !error && messages.length === 0 && (
                <p className="py-8 text-center text-sm text-white/50">No new client emails found.</p>
              )}

              {!loading && messages.length > 0 && (
                <ul className="space-y-2">
                  {messages.map((message) => (
                    <li
                      key={message.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-white">
                            {message.subject || "(no subject)"}
                          </span>
                          {message.synced && (
                            <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                              Synced
                            </span>
                          )}
                        </div>
                        <div className="mt-1 truncate text-xs text-white/50">
                          {senderName(message.from)}
                          {message.date ? ` · ${formatReceived(message.date)}` : ""}
                          {` · ${message.attachmentCount} attachment${
                            message.attachmentCount === 1 ? "" : "s"
                          }`}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => importMessage(message.id)}
                        disabled={Boolean(importingId)}
                        className="shrink-0 rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {importingId === message.id ? "Importing…" : "Import"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
