import { describe, it, expect } from "vitest";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import { createTestUser } from "@/tests/helpers/factories";
import { setTestUser } from "@/tests/helpers/auth-helper";
import { completeMonthlyMock } from "@/app/actions/monthly-actions";
import { getMonthlyMockState, recordMonthlyMock } from "@/lib/monthly-mock";

const result = { solved: 3, hinted: 1, failed: 1, durationSec: 3600 };

describe("Monthly mock (Integration)", () => {
  it("credits the first mock to this month and locks until next month's last day", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "monthly1@example.com" }, tx);
      await tx.userSettings.create({ data: { userId: user.id, timezone: "UTC" } });
      const now = new Date("2026-09-10T12:00:00Z");

      expect((await getMonthlyMockState(user.id, now)).status.state).toBe("first");
      const mock = await recordMonthlyMock(user.id, { ...result, sessionId: "s1" }, now);
      expect(mock.period).toBe("2026-09");

      const state = await getMonthlyMockState(user.id, now);
      expect(state.status).toMatchObject({ state: "locked", creditPeriod: "2026-10", opensAt: Date.UTC(2026, 9, 31) });
      expect(state.history).toHaveLength(1);
    });
  });

  it("records a session once, even if completion is sent again", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "monthly2@example.com" }, tx);
      setTestUser(user);

      const first = await completeMonthlyMock({ ...result, sessionId: "same-session" });
      const again = await completeMonthlyMock({ ...result, sessionId: "same-session" });
      expect(again.period).toBe(first.period);
      expect(await tx.monthlyMock.count({ where: { userId: user.id } })).toBe(1);
    });
  });

  it("won't let one user replay another user's session id", async () => {
    await runInTestTransaction(async (tx) => {
      const a = await createTestUser({ email: "monthly3a@example.com" }, tx);
      const b = await createTestUser({ email: "monthly3b@example.com" }, tx);
      await recordMonthlyMock(b.id, { ...result, sessionId: "b-session" });
      setTestUser(a);
      await expect(completeMonthlyMock({ ...result, sessionId: "b-session" })).rejects.toThrow();
    });
  });
});
