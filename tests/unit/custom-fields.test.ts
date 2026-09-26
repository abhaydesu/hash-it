import { describe, it, expect } from "vitest";
import {
  coerceCustomValue,
  fieldIdFromLabel,
  inferFieldType,
  mergeSelectOptions,
  readCustomFieldDefs,
  sanitizeCustomValues,
  suggestMapping,
  type CustomFieldDef,
} from "@/lib/custom-fields";
import { initialChoices, resolveChoices } from "@/components/import/column-mapper";
import type { CsvInspection } from "@/app/actions/import-actions";

describe("suggestMapping", () => {
  it("maps our template headers and common synonyms to built-ins", () => {
    const m = suggestMapping(["Question", "URL", "Notes", "What I did wrong", "Date Solved", "Company"]);
    expect(m["Question"]).toEqual({ kind: "builtin", key: "name" });
    expect(m["URL"]).toEqual({ kind: "builtin", key: "link" });
    expect(m["Notes"]).toEqual({ kind: "builtin", key: "idea" });
    expect(m["What I did wrong"]).toEqual({ kind: "builtin", key: "mistake" });
    expect(m["Date Solved"]).toEqual({ kind: "builtin", key: "solvedDate" });
    expect(m["Company"]).toBeNull();
  });

  it("ignores punctuation and underscores in headers", () => {
    const m = suggestMapping(["Redo?", "solved_date", "Problem-Link"]);
    expect(m["Redo?"]).toEqual({ kind: "builtin", key: "revisit" });
    expect(m["solved_date"]).toEqual({ kind: "builtin", key: "solvedDate" });
    expect(m["Problem-Link"]).toEqual({ kind: "builtin", key: "link" });
  });

  it("gives each built-in to the first matching column only", () => {
    const m = suggestMapping(["Title", "Name"]);
    expect(m["Title"]).toEqual({ kind: "builtin", key: "name" });
    expect(m["Name"]).toBeNull();
  });

  it("re-links a column to an existing custom field by label", () => {
    const existing: CustomFieldDef[] = [{ id: "company", label: "Company", type: "text" }];
    expect(suggestMapping([" company "], existing)[" company "]).toEqual({ kind: "custom", fieldId: "company" });
  });
});

describe("inferFieldType", () => {
  it("detects yes/no, numbers, dates, pick-lists and text", () => {
    expect(inferFieldType(["Yes", "no", "", "yes"]).type).toBe("boolean");
    expect(inferFieldType(["1", "0", "1"]).type).toBe("number");
    expect(inferFieldType(["12", "3.5", "1,200"]).type).toBe("number");
    expect(inferFieldType(["2024-01-02", "03/15/2024"]).type).toBe("date");
    const sel = inferFieldType(["Google", "Meta", "Google", "Meta", "Amazon", "Amazon"]);
    expect(sel).toEqual({ type: "select", options: ["Amazon", "Google", "Meta"] });
    expect(inferFieldType(["O(n log n) with a heap", "two pointers from both ends"]).type).toBe("text");
    expect(inferFieldType(["", " "]).type).toBe("text");
  });
});

describe("coercion", () => {
  const num: CustomFieldDef = { id: "t", label: "T", type: "number" };
  const bool: CustomFieldDef = { id: "b", label: "B", type: "boolean" };
  const date: CustomFieldDef = { id: "d", label: "D", type: "date" };
  const sel: CustomFieldDef = { id: "s", label: "S", type: "select", options: ["Google"] };

  it("converts raw cells to typed values, null when blank or invalid", () => {
    expect(coerceCustomValue(num, "1,200")).toBe(1200);
    expect(coerceCustomValue(num, "abc")).toBeNull();
    expect(coerceCustomValue(bool, "Y")).toBe(true);
    expect(coerceCustomValue(bool, "0")).toBe(false);
    expect(coerceCustomValue(date, "3/15/2024")).toBe("2024-03-15");
    expect(coerceCustomValue(date, "2024-02-31")).toBeNull();
    expect(coerceCustomValue(sel, "google")).toBe("Google");
    expect(coerceCustomValue(sel, "Stripe")).toBe("Stripe");
    expect(coerceCustomValue(num, "  ")).toBeNull();
  });

  it("sanitizeCustomValues drops unknown ids and unconvertible values", () => {
    expect(sanitizeCustomValues([num, bool], { t: "5", b: "maybe", evil: "x" })).toEqual({ t: 5 });
    expect(sanitizeCustomValues([num], "nope")).toEqual({});
  });
});

describe("field ids and defs", () => {
  it("derives unique snake_case ids", () => {
    expect(fieldIdFromLabel("Time Complexity")).toBe("time_complexity");
    expect(fieldIdFromLabel("Company", ["company"])).toBe("company_2");
    expect(fieldIdFromLabel("!!!")).toBe("field");
  });

  it("readCustomFieldDefs drops malformed and duplicate entries", () => {
    expect(
      readCustomFieldDefs([
        { id: "ok", label: "Ok", type: "text" },
        { id: "ok", label: "Dup", type: "text" },
        { id: "Bad Id", label: "x", type: "text" },
        { id: "t", label: "T", type: "weird" },
        null,
      ])
    ).toEqual([{ id: "ok", label: "Ok", type: "text" }]);
    expect(readCustomFieldDefs(null)).toEqual([]);
  });

  it("mergeSelectOptions adds new options case-insensitively", () => {
    const def: CustomFieldDef = { id: "c", label: "C", type: "select", options: ["Google"] };
    expect(mergeSelectOptions(def, ["google", "Meta"]).options).toEqual(["Google", "Meta"]);
  });
});

describe("column mapper choices", () => {
  const inspection: CsvInspection = {
    rowCount: 3,
    existingFields: [{ id: "company", label: "Company", type: "select", options: ["Google"] }],
    columns: [
      { header: "Question", samples: ["Two Sum"], filledCount: 3, suggestion: { kind: "builtin", key: "name" }, inferred: { type: "text" } },
      { header: "Company", samples: ["Google"], filledCount: 3, suggestion: { kind: "custom", fieldId: "company" }, inferred: { type: "text" } },
      { header: "Confidence", samples: ["3"], filledCount: 3, suggestion: null, inferred: { type: "number" } },
      { header: "Empty", samples: [], filledCount: 0, suggestion: null, inferred: { type: "text" } },
    ],
  };

  it("defaults: built-ins linked, existing fields re-used, unknown kept as new, empty ignored", () => {
    const c = initialChoices(inspection);
    expect(c["Question"]).toEqual({ kind: "builtin", key: "name" });
    expect(c["Company"]).toEqual({ kind: "existing", fieldId: "company" });
    expect(c["Confidence"]).toMatchObject({ kind: "new", label: "Confidence", type: "number" });
    expect(c["Empty"]).toEqual({ kind: "ignore" });
  });

  it("resolves to a server mapping plus field defs", () => {
    const { mapping, fields, errors } = resolveChoices(initialChoices(inspection), inspection.existingFields);
    expect(errors).toEqual([]);
    expect(mapping["Confidence"]).toEqual({ kind: "custom", fieldId: "confidence" });
    expect(fields.map((f) => f.id)).toEqual(["company", "confidence"]);
  });

  it("requires a name or link column and rejects duplicate built-ins and labels", () => {
    expect(resolveChoices({ A: { kind: "ignore" } }, []).errors[0]).toMatch(/Problem name or Problem link/);
    const dup = resolveChoices(
      { A: { kind: "builtin", key: "name" }, B: { kind: "builtin", key: "name" } },
      []
    );
    expect(dup.errors.some((e) => e.includes("both map"))).toBe(true);
    const clash = resolveChoices(
      { A: { kind: "builtin", key: "name" }, B: { kind: "new", label: "company", type: "text" } },
      inspection.existingFields
    );
    expect(clash.errors[0]).toMatch(/already exists/);
  });
});
