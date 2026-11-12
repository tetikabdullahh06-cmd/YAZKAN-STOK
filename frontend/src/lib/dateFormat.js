export function dateOnly(value) {
  if (!value) return "-";
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1].slice(-2)}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(parsed);
}

export function dateTimeTR(value) {
  if (!value) return "-";
  const raw = String(value);
  const date = dateOnly(raw);
  const timeMatch = raw.match(/T(\d{2}:\d{2})/);
  return timeMatch ? `${date} ${timeMatch[1]}` : date;
}

export function excelDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}
