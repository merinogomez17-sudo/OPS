const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export const money = (cents: number) => mxn.format(cents / 100);
export const moneyShort = (cents: number) => "$" + (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
export const feeFor = (amountCents: number, feeBps: number) => Math.round((amountCents * feeBps) / 10000);
export const firstName = (full: string) => full.trim().split(/\s+/)[0] || "";
export const initials = (full: string) =>
  full.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const tagUrl = (code: string) => `${siteUrl()}/t/${code}`;
