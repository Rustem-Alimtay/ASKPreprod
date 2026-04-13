import sgMail from "@sendgrid/mail";

let initialized = false;

const ADMIN_EMAIL = "dt.office@adec.ae";

const CATEGORY_EMAILS: Record<string, string> = {
  it_support: "areeb@adec.ae",
  digital_transformation: "radhakrishnan@adec.ae",
  requisition_arf: "anas.aliyar@adec.ae",
};
const APP_URL = process.env.APP_URL || "https://aksportal.com";

function initSendGrid() {
  if (initialized) return;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SendGrid not configured. Set SENDGRID_API_KEY environment variable."
    );
  }

  sgMail.setApiKey(apiKey);
  initialized = true;
}

export async function sendEmail(options: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  initSendGrid();
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER || ADMIN_EMAIL;

  const recipients = Array.isArray(options.to) ? options.to.join(", ") : options.to;
  await sgMail.send({
    to: options.to,
    from: fromEmail,
    subject: options.subject,
    html: options.html,
  });
  console.log(`Email sent to ${recipients}: ${options.subject}`);
}

export function getFromEmail(): string {
  return process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER || "";
}

function emailLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#6d28d9);padding:24px 32px;">
<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Unified Portal</h1>
<p style="margin:4px 0 0;color:#e0d4fc;font-size:13px;">AKS Request Center</p>
</td></tr>
<tr><td style="padding:28px 32px;">
<h2 style="margin:0 0 20px;color:#1a1a2e;font-size:18px;font-weight:600;">${title}</h2>
${body}
</td></tr>
<tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
<p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">This is an automated notification from Unified Portal. Please do not reply to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:6px 12px;color:#1a1a2e;font-size:13px;">${value}</td></tr>`;
}

function actionButton(text: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0 8px;">
<a href="${url}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:10px 28px;border-radius:6px;font-size:14px;font-weight:600;">${text}</a>
</div>`;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    new: "New",
    in_progress: "In Progress",
    under_review: "Under Review",
    resolved: "Resolved",
    closed: "Closed",
  };
  return map[status] || status;
}

function formatCategory(category: string): string {
  const map: Record<string, string> = {
    it_support: "IT Support",
    digital_transformation: "Digital Transformation",
    other: "Other",
  };
  return map[category] || category;
}

function formatSeverity(severity: string): string {
  const map: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  };
  return map[severity] || severity;
}

function escapeHtml(text: string | null | undefined): string {
  return (text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface TicketInfo {
  trackingId: string;
  subject: string;
  description?: string;
  category: string;
  severity: string;
  status: string;
  userEmail: string;
  userName: string;
  assignedToEmail?: string | null;
}

function collectRecipients(ticket: TicketInfo): string[] {
  const set = new Set<string>();
  set.add(ADMIN_EMAIL);
  if (ticket.userEmail) set.add(ticket.userEmail);
  const categoryEmail = CATEGORY_EMAILS[ticket.category];
  if (categoryEmail) set.add(categoryEmail);
  if (ticket.assignedToEmail) set.add(ticket.assignedToEmail);
  return Array.from(set);
}

function sendToRecipients(subject: string, html: string, ticket: TicketInfo) {
  const recipients = collectRecipients(ticket);
  sendEmail({ to: recipients, subject, html }).catch((err) => {
    console.error(`Failed to send ticket notification to ${recipients.join(", ")}:`, err);
  });
}

export function sendTicketCreatedNotification(ticket: TicketInfo) {
  const subjectLine = `[${ticket.trackingId}] New Ticket: ${ticket.subject}`;
  const body = `
<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">A new support ticket has been submitted.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:16px;">
${infoRow("Ticket ID", `<strong>${escapeHtml(ticket.trackingId)}</strong>`)}
${infoRow("Subject", escapeHtml(ticket.subject))}
${infoRow("Category", formatCategory(ticket.category))}
${infoRow("Severity", formatSeverity(ticket.severity))}
${infoRow("Status", formatStatus(ticket.status))}
${infoRow("Submitted By", escapeHtml(ticket.userName))}
${infoRow("Email", escapeHtml(ticket.userEmail))}
</table>
${ticket.description ? `<div style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;padding:12px 16px;margin-bottom:16px;">
<p style="margin:0 0 4px;color:#6b7280;font-size:12px;font-weight:600;">DESCRIPTION</p>
<p style="margin:0;color:#374151;font-size:13px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(ticket.description)}</p>
</div>` : ""}
${actionButton("View Ticket in Portal", `${APP_URL}/intranet`)}`;

  const html = emailLayout("New Ticket Created", body);
  const recipients = collectRecipients(ticket);

  sendEmail({ to: recipients, subject: subjectLine, html }).catch((err) => {
    console.error(`Failed to send ticket creation notification to ${recipients.join(", ")}:`, err);
  });
}

export function sendTicketStatusChangedNotification(
  ticket: TicketInfo,
  oldStatus: string,
  newStatus: string,
  changedByName: string
) {
  const subjectLine = `[${ticket.trackingId}] Status Changed: ${formatStatus(oldStatus)} → ${formatStatus(newStatus)}`;
  const body = `
<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">The status of a ticket has been updated.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:16px;">
${infoRow("Ticket ID", `<strong>${escapeHtml(ticket.trackingId)}</strong>`)}
${infoRow("Subject", escapeHtml(ticket.subject))}
${infoRow("Previous Status", formatStatus(oldStatus))}
${infoRow("New Status", `<strong>${formatStatus(newStatus)}</strong>`)}
${infoRow("Changed By", escapeHtml(changedByName))}
</table>
${actionButton("View Ticket in Portal", `${APP_URL}/intranet`)}`;

  sendToRecipients(subjectLine, emailLayout("Ticket Status Updated", body), ticket);
}

export function sendTicketCommentNotification(
  ticket: TicketInfo,
  commentAuthor: string,
  commentMessage: string
) {
  const subjectLine = `[${ticket.trackingId}] New Comment: ${ticket.subject}`;
  const body = `
<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">A new comment has been added to a ticket.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;margin-bottom:16px;">
${infoRow("Ticket ID", `<strong>${escapeHtml(ticket.trackingId)}</strong>`)}
${infoRow("Subject", escapeHtml(ticket.subject))}
${infoRow("Comment By", escapeHtml(commentAuthor))}
</table>
<div style="background:#f0ecfb;border-radius:6px;border-left:4px solid #7c3aed;padding:12px 16px;margin-bottom:16px;">
<p style="margin:0 0 4px;color:#6b7280;font-size:12px;font-weight:600;">COMMENT</p>
<p style="margin:0;color:#374151;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(commentMessage)}</p>
</div>
${actionButton("View Ticket in Portal", `${APP_URL}/intranet`)}`;

  sendToRecipients(subjectLine, emailLayout("New Comment on Ticket", body), ticket);
}
