export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface LayoutInput {
  firmName: string;
  heading: string;
  intro: string;
  bodyBlocks: string[];
  action?: { label: string; url: string } | undefined;
  footerNote?: string | undefined;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const escapeForEmail = escapeHtml;

export const renderLayout = (input: LayoutInput): { html: string; text: string } => {
  const paragraphs = input.bodyBlocks
    .map(
      (block) =>
        `<p style="margin:0 0 14px;font-size:14px;line-height:22px;color:#334155;">${escapeHtml(block)}</p>`,
    )
    .join('');

  const button = input.action
    ? `<p style="margin:0 0 20px;"><a href="${escapeHtml(input.action.url)}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:500;">${escapeHtml(input.action.label)}</a></p>
       <p style="margin:0 0 14px;font-size:12px;line-height:18px;color:#64748B;">If the button does not work, paste this address into your browser:<br>${escapeHtml(input.action.url)}</p>`
    : '';

  const footer = input.footerNote
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#64748B;">${escapeHtml(input.footerNote)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.heading)}</title></head>
<body style="margin:0;padding:24px;background:#F7F8FA;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #DCE2EA;border-radius:8px;">
<tr><td style="padding:24px;">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#64748B;">${escapeHtml(input.firmName)}</p>
<h1 style="margin:0 0 12px;font-size:20px;line-height:28px;color:#0F172A;font-weight:600;">${escapeHtml(input.heading)}</h1>
<p style="margin:0 0 14px;font-size:14px;line-height:22px;color:#334155;">${escapeHtml(input.intro)}</p>
${paragraphs}
${button}
${footer}
</td></tr></table>
<p style="max-width:560px;margin:16px auto 0;font-size:11px;line-height:16px;color:#7C8BA0;text-align:center;">Sent by FirmDesk on behalf of ${escapeHtml(input.firmName)}.</p>
</body></html>`;

  const textLines = [
    input.firmName.toUpperCase(),
    '',
    input.heading,
    '',
    input.intro,
    '',
    ...input.bodyBlocks,
  ];
  if (input.action) {
    textLines.push('', `${input.action.label}: ${input.action.url}`);
  }
  if (input.footerNote) {
    textLines.push('', input.footerNote);
  }
  textLines.push('', `Sent by FirmDesk on behalf of ${input.firmName}.`);

  return { html, text: textLines.join('\n') };
};
