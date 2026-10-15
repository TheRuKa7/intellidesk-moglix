/** Renders plain text or sanitized HTML email bodies stored on messages. */
export function MessageBody({
  body,
  bodyHtml,
}: {
  body: string;
  bodyHtml?: string | null;
}) {
  if (bodyHtml) {
    return (
      <div className="body body-html body-email">
        <div className="body-email-label">Email</div>
        {/* HTML is sanitized at ingest via sanitize-html in email-parser. */}
        <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </div>
    );
  }
  const text = body.replace(/\n\n\[HTML email\]\s*$/i, '');
  return (
    <div className="body" style={{ whiteSpace: 'pre-wrap' }}>
      {text}
    </div>
  );
}
