// Optional heads-up when something needs a human: a Slack or Discord incoming-webhook URL.
export async function alert(message, { url = process.env.ALERT_WEBHOOK_URL, fetchImpl = fetch } = {}) {
  if (!url) return false;
  try {
    await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message, content: message.slice(0, 1900) }), // Slack reads `text`, Discord reads `content`
    });
    return true;
  } catch {
    return false;
  }
}

/** Which results deserve a ping. Quiet on normal days. */
export function alertFor(result) {
  if (result.status === 'error') return `🔴 Byte Finance failed: ${result.error}`;
  if (result.status === 'skipped-no-content') return '🟠 Byte Finance skipped today: no market data and no stories passed the checks.';
  if (result.status === 'posted') {
    const notes = [];
    if (result.board?.missing?.length) notes.push(`board left out (missing: ${result.board.missing.map((m) => m.key).join(', ')})`);
    const n = Object.keys(result.stories || {}).length;
    if (n < 3) notes.push(`only ${n} of 3 stories passed the checks`);
    if (notes.length) return `🟡 Byte Finance posted with gaps: ${notes.join('; ')}.`;
  }
  return null;
}
