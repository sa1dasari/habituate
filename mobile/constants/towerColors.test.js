import { TOWER_COLOR_KEYS, TOWER_COLOR_PALETTE, resolveHabitColor, towerColorHex } from './towerColors';

const cats = { Health: '#111111', Other: '#222222' };

describe('resolveHabitColor', () => {
  it('has the 12 board keys in order', () => {
    expect(TOWER_COLOR_KEYS).toEqual([
      'coral', 'amber', 'lime', 'green', 'teal', 'cyan', 'sky', 'indigo', 'violet', 'pink', 'rose', 'slate',
    ]);
    TOWER_COLOR_PALETTE.forEach((c) => {
      expect(c.dark).toMatch(/^#[0-9A-F]{6}$/);
      expect(c.light).toMatch(/^#[0-9A-F]{6}$/);
    });
  });
  it('uses the picked colour per mode', () => {
    expect(resolveHabitColor({ color: 'coral', category: 'Health' }, 'dark', cats)).toBe('#FF8A5B');
    expect(resolveHabitColor({ color: 'coral', category: 'Health' }, 'light', cats)).toBe('#DC6738');
  });
  it('falls back to the category colour when unset', () => {
    expect(resolveHabitColor({ category: 'Health' }, 'dark', cats)).toBe('#111111');
    expect(resolveHabitColor({ color: null, category: 'Health' }, 'light', cats)).toBe('#111111');
  });
  it('ignores an unknown key and falls back, then to Other', () => {
    expect(resolveHabitColor({ color: 'chartreuse', category: 'Health' }, 'dark', cats)).toBe('#111111');
    expect(resolveHabitColor({ color: 'toString', category: 'Nope' }, 'dark', cats)).toBe('#222222');
  });
  it('towerColorHex returns null for unknown keys', () => {
    expect(towerColorHex('nope', 'dark')).toBeNull();
  });
});
