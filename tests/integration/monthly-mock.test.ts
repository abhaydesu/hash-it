import { describe, it, expect } from "vitest";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import { createTestUser, createTestProblem, createTestEntry } from "@/tests/helpers/factories";
import { setTestUser } from "@/tests/helpers/auth-helper";
import { completeMonthlyMock, saveMonthlyMockNotes } from "@/app/actions/monthly-actions";
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

  it("saves wrap-up notes only on the caller's own entries, leaving untouched fields alone", async () => {
    await runInTestTransaction(async (tx) => {
      const me = await createTestUser({}, tx);
      const other = await createTestUser({}, tx);
      const problem = await createTestProblem({}, tx);
      const { entry: mine } = await createTestEntry(me.id, problem.id, { idea: "old idea", mistake: "old mistake" }, tx);
      const { entry: theirs } = await createTestEntry(other.id, problem.id, { idea: "theirs" }, tx);
      setTestUser(me);

      const res = await saveMonthlyMockNotes([
        { entryId: mine.id, mistake: "  off-by-one on the window  " },
        { entryId: theirs.id, idea: "hijacked" },
      ]);
      expect(res.saved).toBe(1);

      const after = await tx.entry.findUniqueOrThrow({ where: { id: mine.id } });
      expect(after).toMatchObject({ idea: "old idea", mistake: "off-by-one on the window" });
      expect((await tx.entry.findUniqueOrThrow({ where: { id: theirs.id } })).idea).toBe("theirs");
    });
  });
});
