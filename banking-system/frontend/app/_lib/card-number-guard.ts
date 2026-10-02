// Client-side guard against customers pasting a full card number (PAN).
// This is a usability safeguard only: the backend must still mask and reject
// sensitive data on its own, because the browser can never be trusted.

// 13 to 19 digits, optionally separated by single spaces or dashes.
const CARD_NUMBER_PATTERN = /(?:\d[ -]?){12,18}\d/;

function passesLuhnCheck(digits: string): boolean {
  let sum = 0;
  let shouldDouble = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function containsFullCardNumber(text: string): boolean {
  const match = text.match(CARD_NUMBER_PATTERN);
  if (!match) return false;
  const digits = match[0].replace(/[ -]/g, "");
  return digits.length >= 13 && digits.length <= 19 && passesLuhnCheck(digits);
}
