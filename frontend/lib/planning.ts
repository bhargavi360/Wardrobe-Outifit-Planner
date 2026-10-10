export type WardrobePiece = { id: string; name: string; category: string; image_url: string; availability?: 'available' | 'laundry' };
export type SavedLook = { id: string; name: string; occasion: string; items: { item_id: string; name: string; category: string }[] };
export type CalendarDay = { id: string; date: string; outfit_id: string; name: string; items: SavedLook['items']; status: 'planned' | 'worn' };
export type Trip = { id: string; name: string; destination: string; start_date: string; end_date: string; outfit_ids: string[]; outfit_names: string[]; packed_item_ids: string[]; items: { item_id: string; name: string; category: string; outfit_names: string[] }[] };

export function localDay(value = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
export function shiftDay(day: string, amount: number): string {
  const value = new Date(`${day}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return localDay(value);
}
export function monday(day: string): string {
  return shiftDay(day, -(new Date(`${day}T12:00:00`).getDay() + 6) % 7);
}
export function prettyDay(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
