const { skyKind, SKY_KINDS } = require('./sky');

function at(hour, minute = 0) {
  const d = new Date('2026-06-15T00:00:00');
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe('skyKind', () => {
  test('fixed windows without sunrise/sunset: dawn 5-8, day 8-18, night otherwise', () => {
    expect(skyKind({ now: at(6) })).toBe('dawn');
    expect(skyKind({ now: at(12) })).toBe('day');
    expect(skyKind({ now: at(20) })).toBe('night');
    expect(skyKind({ now: at(2) })).toBe('night');
  });

  test('sunrise/sunset override the fixed windows when known', () => {
    const sunrise = at(6, 30);
    const sunset = at(19, 45);
    expect(skyKind({ now: at(6, 0), sunrise, sunset })).toBe('dawn'); // 1h before sunrise
    expect(skyKind({ now: at(12), sunrise, sunset })).toBe('day');
    expect(skyKind({ now: at(21), sunrise, sunset })).toBe('night');
  });

  test('weather overrides the daytime base kind', () => {
    expect(skyKind({ now: at(12), weatherCode: 'light rain' })).toBe('rain');
    expect(skyKind({ now: at(12), weatherCode: 'heavy snow' })).toBe('snow');
    expect(skyKind({ now: at(12), weatherCode: 'overcast clouds' })).toBe('overcast');
    expect(skyKind({ now: at(12), weatherCode: 'thunderstorm' })).toBe('rain');
  });

  test('clear weather defers to the time-based kind, not a separate "clear" kind', () => {
    expect(skyKind({ now: at(12), weatherCode: 'clear sky' })).toBe('day');
    expect(skyKind({ now: at(6), weatherCode: 'clear sky' })).toBe('dawn');
  });

  test('weather never overrides night', () => {
    expect(skyKind({ now: at(22), weatherCode: 'heavy rain' })).toBe('night');
    expect(skyKind({ now: at(22), weatherCode: 'snow' })).toBe('night');
  });

  test('defaults to now() when `now` is omitted, and always returns a known kind', () => {
    const result = skyKind({});
    expect(SKY_KINDS).toContain(result);
  });
});
