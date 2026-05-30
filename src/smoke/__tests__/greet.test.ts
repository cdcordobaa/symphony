import { greet } from '../greet';

describe('greet', () => {
  it('greets World with the Symphony live message', () => {
    expect(greet('World')).toBe('Hello, World! Symphony is live.');
  });
});
