import { getResend } from "../../config/resend.js";

/**
 * Send email via Resend.
 * @param {{ to: string | string[]; subject: string; html: string; text?: string; replyTo?: string }} params
 */
export async function sendResendEmail({ to, subject, html, text, replyTo }) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from?.trim()) {
    throw new Error("RESEND_FROM_EMAIL is not set");
  }
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const toList = Array.isArray(to) ? to : [to];
  if (toList.length === 0) {
    throw new Error("No recipients");
  }

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: from.trim(),
    to: toList,
    subject,
    html,
    ...(text ? { text } : {}),
    ...(replyTo ? { replyTo } : {}),
  });

  if (error) {
    const msg =
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : JSON.stringify(error);
    throw new Error(msg || "Resend send failed");
  }
  return data;
}
