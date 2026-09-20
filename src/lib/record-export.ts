import type { SettlementRecord } from '../../shared/protocol';

export function csvCell(value: string | number | boolean) {
  let text = String(value);
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportRecordJson(record: SettlementRecord) {
  download(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }), `meja52-${record.code}.json`);
}

export function exportRecordCsv(record: SettlementRecord) {
  const cash = record.settings.buyInPrice > 0;
  const header = ['Player', 'Total entered (chips)', 'Final balance (chips)', 'Net (chips)', ...(cash ? [`Net (${record.currency})`] : []), 'Left early'];
  const rows = record.players.map((player) => [
    player.name,
    player.totalEntered,
    player.finalBalance,
    player.finalBalance - player.totalEntered,
    ...(cash ? [(player.net / 100).toFixed(2)] : []),
    player.leftEarly,
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  download(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }), `meja52-${record.code}-ledger.csv`);
}

export function exportRecordImage(record: SettlementRecord, amount: (value: number, signed?: boolean) => string) {
  const width = 1080;
  const rowHeight = 92;
  const height = 480 + record.players.length * rowHeight;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#f4f0e6';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#203554';
  ctx.font = '600 30px system-ui, sans-serif';
  ctx.fillText('MEJA52', 76, 90);
  ctx.textAlign = 'right';
  ctx.font = '500 24px ui-monospace, monospace';
  ctx.fillText(record.code, width - 76, 90);
  ctx.textAlign = 'left';
  ctx.font = '650 58px system-ui, sans-serif';
  ctx.fillText(record.finalizedWithIssues ? 'Final record · issue noted' : 'Settlement complete', 76, 190);
  ctx.font = '400 25px system-ui, sans-serif';
  ctx.fillStyle = '#667085';
  ctx.fillText(`${record.players.length} players · ${record.handCount} hands`, 76, 238);
  let y = 340;
  for (const player of record.players) {
    ctx.strokeStyle = '#d6d0c5';
    ctx.beginPath(); ctx.moveTo(76, y + 36); ctx.lineTo(width - 76, y + 36); ctx.stroke();
    ctx.fillStyle = '#203554';
    ctx.textAlign = 'left';
    ctx.font = '560 29px system-ui, sans-serif';
    ctx.fillText(player.name, 76, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = player.net > 0 ? '#2f6b54' : player.net < 0 ? '#a2323f' : '#203554';
    ctx.font = '650 31px ui-monospace, monospace';
    ctx.fillText(amount(player.net, true), width - 76, y);
    y += rowHeight;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#667085';
  ctx.font = '400 21px system-ui, sans-serif';
  ctx.fillText('Private record · No money is transferred by MEJA52', 76, height - 64);
  canvas.toBlob((blob) => blob && download(blob, `meja52-${record.code}-settlement.png`), 'image/png');
}
