/**
 * Converts numeric amounts into Indian English words (e.g. 1000 -> "One Thousand Rupees only")
 */
export function numberToIndianWords(amount: number): string {
  const rounded = Math.round(amount);
  if (isNaN(rounded) || rounded <= 0) {
    return 'Zero Rupees only';
  }

  const singleDigits = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return singleDigits[n];
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    return unit === 0 ? tens[ten] : `${tens[ten]} ${singleDigits[unit]}`;
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    if (hundred === 0) return convertTwoDigits(rest);
    if (rest === 0) return `${singleDigits[hundred]} Hundred`;
    return `${singleDigits[hundred]} Hundred ${convertTwoDigits(rest)}`;
  }

  let num = rounded;
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  const remainder = num % 1000;

  const parts: string[] = [];

  if (crore > 0) {
    parts.push(`${convertThreeDigits(crore)} Crore`);
  }
  if (lakh > 0) {
    parts.push(`${convertThreeDigits(lakh)} Lakh`);
  }
  if (thousand > 0) {
    parts.push(`${convertThreeDigits(thousand)} Thousand`);
  }
  if (remainder > 0) {
    parts.push(convertThreeDigits(remainder));
  }

  const result = parts.join(' ').trim();
  return result ? `${result} Rupees only` : 'Zero Rupees only';
}
