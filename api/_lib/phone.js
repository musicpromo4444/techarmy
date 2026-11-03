import { parsePhoneNumberFromString } from "libphonenumber-js";
export function normalizeWhatsApp(phone, countryCode) {
  if (typeof phone !== "string" || typeof countryCode !== "string") return null;
  const parsed = parsePhoneNumberFromString(phone.trim(), countryCode);
  if (!parsed || !parsed.isValid()) return null;
  if (parsed.country && parsed.country !== countryCode) return null;
  return parsed.number;
}
