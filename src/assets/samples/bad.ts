function calculateTotal(items: Array<{ price: number | string }>): number {
  let total = 0;

  // Iterate safely and coerce price to number when possible
  for (const item of items) {
    const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
    total += Number.isFinite(price) ? (price as number) : 0;
  }

  // Ensure the result is numeric
  return total;
}