/**
 * Build a self-contained HTML error page for cases where we have no
 * validated redirect_uri to send the user back to (e.g. missing cookie,
 * unknown auth request). Keeps the browser from seeing raw JSON.
 */
export function buildErrorPage(
  error: string,
  description: string,
): { html: string } {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authentication Error</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0d1117; color: #c9d1d9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 2rem; max-width: 480px; width: 90%; text-align: center; }
    h1 { color: #f85149; font-size: 1.2rem; margin-top: 0; }
    p { color: #8b949e; font-size: 0.95rem; line-height: 1.5; }
    code { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 0.15rem 0.4rem; font-size: 0.85rem; color: #f0883e; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authentication Error</h1>
    <p>${description}</p>
    <p><code>${error}</code></p>
  </div>
</body>
</html>`;

  return { html };
}
