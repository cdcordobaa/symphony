import { ping } from "./ping.js";

describe("ping", () => {
  it('returns "pong"', () => {
    expect(ping()).toBe("pong");
  });
});
