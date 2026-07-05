export function normalizeIndianPhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  const nationalNumber = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  }
  return `+91${nationalNumber}`;
}

export function passwordCredentials(identifier: string, password: string) {
  const trimmed = identifier.trim();
  return trimmed.includes("@")
    ? { email: trimmed.toLowerCase(), password }
    : { phone: normalizeIndianPhone(trimmed), password };
}
