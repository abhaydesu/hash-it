import { describe, it, expect } from "vitest";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import { createTestUser, createTestProblem, createTestUserSettings } from "@/tests/helpers/factories";
import { setTestUser } from "@/tests/helpers/auth-helper";
import { createEntry, updateEntryCustomValues } from "@/app/actions/entry-actions";
import { getCustomFields, saveCustomFields } from "@/app/actions/settings-actions";
import { commitImportBatch, dryRunImportCSV, inspectImportCSV } from "@/app/actions/import-actions";

const CSV = [
  "Question,URL,Company,Confidence,Redo later,Notes",
  `Custom Sheet Problem ${Date.now()},https://example.com/p/1,Google,4,yes,Sliding window`,
  `Custom Sheet Problem B ${Date.now()},https://example.com/p/2,Meta,2,no,`,
].join("\n");

describe("Custom fields (Integration)", () => {
  it("imports a user's own sheet: maps headers, creates typed fields, stores values", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "custom_fields_import@example.com" }, tx);
      await createTestUserSettings(user.id, {}, tx);
      setTestUser(user);

      const inspection = await inspectImportCSV(CSV);
      const byHeader = Object.fromEntries(inspection.columns.map((c) => [c.header, c]));
      expect(byHeader["Question"].suggestion).toEqual({ kind: "builtin", key: "name" });
      expect(byHeader["URL"].suggestion).toEqual({ kind: "builtin", key: "link" });
      expect(byHeader["Notes"].suggestion).toEqual({ kind: "builtin", key: "idea" });
      expect(byHeader["Company"].suggestion).toBeNull();
      expect(byHeader["Confidence"].inferred.type).toBe("number");
      expect(byHeader["Redo later"].inferred.type).toBe("boolean");

      const mapping = {
        Question: { kind: "builtin", key: "name" },
        URL: { kind: "builtin", key: "link" },
        Notes: { kind: "builtin", key: "idea" },
        Company: { kind: "custom", fieldId: "company" },
        Confidence: { kind: "custom", fieldId: "confidence" },
        "Redo later": { kind: "ignore" },
      } as const;
      const dry = await dryRunImportCSV(CSV, mapping);
      expect(dry.rows).toHaveLength(2);
      expect(dry.rows[0].rawIdea).toBe("Sliding window");
      expect(dry.rows[0].customRaw).toEqual({ company: "Google", confidence: "4" });

      const res = await commitImportBatch({
        rows: dry.rows,
        conflictStrategy: "SKIP",
        customFields: [
          { id: "company", label: "Company", type: "text" },
          { id: "confidence", label: "Confidence", type: "number" },
        ],
      });
      expect(res.count).toBe(2);

      expect((await getCustomFields()).map((f) => f.id)).toEqual(["company", "confidence"]);
      const entries = await tx.entry.findMany({
        where: { userId: user.id },
        include: { reviewCard: true },
        orderBy: { problem: { title: "asc" } },
      });
      const values = entries.map((e: { customValues: unknown }) => e.customValues);
      expect(values).toContainEqual({ company: "Google", confidence: 4 });
      expect(values).toContainEqual({ company: "Meta", confidence: 2 });
      // Custom columns never block scheduling: every row still gets a card.
      expect(entries.every((e: { reviewCard: unknown }) => e.reviewCard)).toBe(true);

      // Re-importing the same sheet suggests the saved fields back.
      const again = await inspectImportCSV(CSV);
      expect(again.columns.find((c) => c.header === "Company")?.suggestion).toEqual({
        kind: "custom",
        fieldId: "company",
      });
    });
  });

  it("dry-run without a name or link column is rejected", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "custom_fields_noname@example.com" }, tx);
      setTestUser(user);
      await expect(dryRunImportCSV(CSV, { Company: { kind: "custom", fieldId: "company" } })).rejects.toThrow(
        /Problem name or Problem link/
      );
    });
  });

  it("log + edit: values are validated against the user's defs and other users' ids are ignored", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "custom_fields_log@example.com" }, tx);
      await createTestUserSettings(user.id, {}, tx);
      const problem = await createTestProblem({ title: "Custom Log Problem", difficulty: "EASY" }, tx);
      setTestUser(user);

      await saveCustomFields([
        { id: "company", label: "Company", type: "select", options: ["Google", "Meta"] },
        { id: "confidence", label: "Confidence", type: "number" },
      ]);

      const { entryId } = await createEntry({
        problemId: problem.id,
        status: "SOLVED_UNAIDED",
        minutes: 10,
        customValues: { company: "google", confidence: "3" as unknown as number, unknown_field: "x" },
      });
      let entry = await tx.entry.findUnique({ where: { id: entryId } });
      expect(entry.customValues).toEqual({ company: "Google", confidence: 3 });

      // Clearing one value keeps the other.
      await updateEntryCustomValues(entryId!, { company: null });
      entry = await tx.entry.findUnique({ where: { id: entryId } });
      expect(entry.customValues).toEqual({ confidence: 3 });

      // A field's type is fixed once saved.
      await expect(
        saveCustomFields([{ id: "confidence", label: "Confidence", type: "text" }])
      ).rejects.toThrow(/can't be changed/);
    });
  });
});
