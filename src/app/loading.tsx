export default function Loading() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <div className="app-loading-spinner" aria-hidden="true" />
      <p>Loading IntelliDesk…</p>
    </div>
  );
}
