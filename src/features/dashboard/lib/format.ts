const numbers = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
export const formatNumber = (value: number | null) => value === null ? "N/A" : numbers.format(value);
export const formatDate = (date: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("id-ID", { ...options, timeZone: "Asia/Makassar" }).format(new Date(`${date}T12:00:00+08:00`));
