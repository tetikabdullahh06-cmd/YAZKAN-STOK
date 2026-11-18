import { buildReturnPayload, hasRecipeStockHistory, makeReturnChoices } from "./recipeReturns";

const makeLines = () => [
  { line_id: "tool-1", reference_id: "same-product", name: "Takım 1", outstanding_quantity: 5 },
  { line_id: "tool-2", reference_id: "same-product", name: "Takım 2", outstanding_quantity: 0.75 },
  { line_id: "holder-1", reference_id: "holder", name: "Tutucu", outstanding_quantity: 3 },
  { line_id: "unused", reference_id: "other", name: "Seçilmemiş", outstanding_quantity: 7 },
];

const fixture = () => {
  const lines = makeLines();
  const choices = makeReturnChoices(lines);
  choices["tool-1"].selected = true;
  const options = { request_id: "return-123", return_date: "18/11/26" };
  return { lines, choices, options };
};

const deepFreeze = (value) => {
  Object.values(value).forEach((child) => {
    if (child && typeof child === "object") deepFreeze(child);
  });
  return Object.freeze(value);
};

describe("makeReturnChoices", () => {
  test("defaults every line to unselected and healthy, capped at one, with distinct line IDs", () => {
    const lines = [...makeLines(), { line_id: "completed", outstanding_quantity: 0 }];
    const choices = makeReturnChoices(lines);

    expect(choices).toEqual({
      "tool-1": { selected: false, quantity: "1", condition: "healthy", note: "" },
      "tool-2": { selected: false, quantity: "0.75", condition: "healthy", note: "" },
      "holder-1": { selected: false, quantity: "1", condition: "healthy", note: "" },
      unused: { selected: false, quantity: "1", condition: "healthy", note: "" },
      completed: { selected: false, quantity: "0", condition: "healthy", note: "" },
    });
    expect(choices["tool-1"]).not.toBe(choices["tool-2"]);
    choices["tool-1"].selected = true;
    expect(choices["tool-2"].selected).toBe(false);
  });
});

describe("buildReturnPayload", () => {
  test("includes only selected lines with all three conditions, canonical date, and trimmed notes", () => {
    const { lines, choices, options } = fixture();
    choices["tool-1"] = { selected: true, quantity: "2", condition: "healthy", note: "  sağlam  " };
    choices["tool-2"] = { selected: true, quantity: "0.5", condition: "broken", note: " kırık\n" };
    choices["holder-1"] = { selected: true, quantity: "1", condition: "scrap", note: "\thurda " };
    choices.unused = { selected: false, quantity: "invalid", condition: "unknown", note: "ignore" };

    expect(buildReturnPayload(choices, lines, { ...options, note: "  genel not\n" })).toEqual({
      request_id: "return-123",
      return_date: "2026-11-18",
      note: "genel not",
      items: [
        { line_id: "tool-1", quantity: 2, condition: "healthy", note: "sağlam" },
        { line_id: "tool-2", quantity: 0.5, condition: "broken", note: "kırık" },
        { line_id: "holder-1", quantity: 1, condition: "scrap", note: "hurda" },
      ],
    });
  });

  test("accepts a real leap day and defaults the overall note to empty", () => {
    const { lines, choices, options } = fixture();
    expect(buildReturnPayload(choices, lines, { ...options, return_date: "29/02/24" })).toMatchObject({
      return_date: "2024-02-29", note: "",
    });
  });

  test("rejects an empty selection, including an empty line list", () => {
    const { lines, options } = fixture();
    expect(() => buildReturnPayload(makeReturnChoices(lines), lines, options)).toThrow(/en az bir/);
    expect(() => buildReturnPayload({}, [], options)).toThrow(/en az bir/);
  });

  test("rejects a missing request ID", () => {
    const { lines, choices, options } = fixture();
    [undefined, null, ""].forEach((request_id) => {
      expect(() => buildReturnPayload(choices, lines, { ...options, request_id })).toThrow(/kimliği eksik/);
    });
  });

  test("rejects malformed dates, impossible dates, and leap days in non-leap years", () => {
    const { lines, choices, options } = fixture();
    ["", "not-a-date", "31/04/26", "32/01/26", "18/13/26", "29/02/25", "2025-02-29"].forEach((return_date) => {
      expect(() => buildReturnPayload(choices, lines, { ...options, return_date })).toThrow(/GG\/AA\/YY/);
    });
  });

  test("rejects zero, negative, NaN, and infinite quantities", () => {
    const { lines, choices, options } = fixture();
    ["0", "-1", "", "not-a-number", NaN, Infinity, -Infinity, "Infinity"].forEach((quantity) => {
      choices["tool-1"].quantity = quantity;
      expect(() => buildReturnPayload(choices, lines, options)).toThrow(/0'dan büyük/);
    });
  });

  test("rejects quantities exceeding the line's remaining quantity", () => {
    const { lines, choices, options } = fixture();
    choices["tool-1"].quantity = "5.000001";
    expect(() => buildReturnPayload(choices, lines, options)).toThrow(/kalan miktardan fazla/);
  });

  test("rejects unknown and inherited condition names", () => {
    const { lines, choices, options } = fixture();
    ["unknown", "Healthy", "", undefined, "toString", "__proto__"].forEach((condition) => {
      choices["tool-1"].condition = condition;
      expect(() => buildReturnPayload(choices, lines, options)).toThrow(/Sağlam, kırık veya hurda/);
    });
  });

  test("rejects quantities with more than six meaningful decimal places", () => {
    const { lines, choices, options } = fixture();
    ["0.1234567", "1.0000001"].forEach((quantity) => {
      choices["tool-1"].quantity = quantity;
      expect(() => buildReturnPayload(choices, lines, options)).toThrow(/6 ondalık/);
    });
  });

  test("allows exact six-decimal fractional quantities, including the full remaining quantity", () => {
    const { lines, choices, options } = fixture();
    lines[0].outstanding_quantity = 0.123456;
    choices["tool-1"].quantity = "0.123456";
    expect(buildReturnPayload(choices, lines, options).items).toEqual([
      { line_id: "tool-1", quantity: 0.123456, condition: "healthy", note: "" },
    ]);
  });

  test("does not mutate lines, choices, or options on success or rejection", () => {
    const { lines, choices, options } = fixture();
    choices["tool-1"].note = "  unchanged  ";
    options.note = "  original  ";
    const before = JSON.stringify({ lines, choices, options });
    [lines, choices, options].forEach(deepFreeze);

    makeReturnChoices(lines);
    const payload = buildReturnPayload(choices, lines, options);
    payload.items[0].note = "changed output";
    expect(() => buildReturnPayload(choices, lines, { ...options, return_date: "invalid" })).toThrow();
    expect(JSON.stringify({ lines, choices, options })).toBe(before);
  });

  test("rejects a selected completed line with zero outstanding quantity", () => {
    const { lines, choices, options } = fixture();
    lines[0].outstanding_quantity = 0;
    choices["tool-1"].quantity = "1";
    expect(() => buildReturnPayload(choices, lines, options)).toThrow(/kalan miktardan fazla/);
    choices["tool-1"].quantity = "0";
    expect(() => buildReturnPayload(choices, lines, options)).toThrow(/0'dan büyük/);
  });
});

describe("hasRecipeStockHistory", () => {
  test("recognizes stock-history markers without mutation, but not a plain draft", () => {
    const cases = [
      [{}, false],
      [{ status: "draft", bound_at: null, pending_operation: null, return_history: [] }, false],
      [{ status: "bound" }, true],
      [{ status: "returned" }, true],
      [{ status: "draft", bound_at: "2026-11-18T09:00:00Z" }, true],
      [{ status: "draft", pending_operation: { request_id: "pending-1" } }, true],
      [{ status: "draft", return_history: [{ request_id: "return-1" }] }, true],
    ];
    cases.forEach(([recipe, expected]) => {
      const before = JSON.stringify(recipe);
      deepFreeze(recipe);
      expect(hasRecipeStockHistory(recipe)).toBe(expected);
      expect(JSON.stringify(recipe)).toBe(before);
    });
  });
});
