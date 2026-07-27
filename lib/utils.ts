// lib/utils.ts

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export function formatMoney(amount: number): string {
  if (amount === undefined || amount === null) amount = 0;
  const fixed = amount.toFixed(2);
  const parts = fixed.split('.');
  const intPart = parts[0];
  const decPart = parts[1];
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + decPart + ' ₽';
  return formatted;
}