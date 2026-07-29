import { Resend } from "resend";

let _resend;

/**
 * Lazy Resend client (safe when RESEND_API_KEY is unset until send is called).
 * @returns {Resend}
 */
export function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}
