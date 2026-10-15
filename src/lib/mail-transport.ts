/**
 * Outbound mail via Nodemailer (MIT) — JSON transport for prototype;
 * swap to SMTP pool in production (same API Zammad-style desks use).
 * @see https://github.com/nodemailer/nodemailer
 */
import nodemailer from 'nodemailer';

export type MailPayload = {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  text: string;
  html?: string;
};

let transport: nodemailer.Transporter | null = null;

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({ jsonTransport: true });
  }
  return transport;
}

/** Sends via nodemailer JSON transport; returns serialized message for audit. */
export async function sendMail(payload: MailPayload): Promise<string> {
  const result = await getTransport().sendMail({
    from: payload.from,
    to: payload.to,
    cc: payload.cc,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
  return typeof result.message === 'string' ? result.message : JSON.stringify(result.message);
}
