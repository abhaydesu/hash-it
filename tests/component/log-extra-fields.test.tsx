import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogExtraFields } from "@/components/log-extra-fields";

vi.mock("@/app/actions/settings-actions", () => ({
  addCustomField: vi.fn(),
  getLogFormConfig: vi.fn().mockResolvedValue({ customFields: [], sources: [] }),
}));

describe("LogExtraFields - Source field", () => {
  it("renders when showSource is true and displays existing sources in dropdown", async () => {
    const handleSourceChange = vi.fn();
    render(
      <LogExtraFields
        fields={[]}
        onFieldsChange={vi.fn()}
        values={{}}
        onValuesChange={vi.fn()}
        sources={["Blind 75", "NeetCode 150"]}
        source=""
        onSourceChange={handleSourceChange}
      />
    );

    const input = screen.getByLabelText(/Source \/ list/i);
    expect(input).toBeInTheDocument();

    await userEvent.click(input);

    expect(screen.getByRole("option", { name: "Blind 75" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "NeetCode 150" })).toBeInTheDocument();
  });

  it("selects an existing source from suggestions and commits it as tag", async () => {
    const handleSourceChange = vi.fn();
    render(
      <LogExtraFields
        fields={[]}
        onFieldsChange={vi.fn()}
        values={{}}
        onValuesChange={vi.fn()}
        sources={["Blind 75", "NeetCode 150"]}
        source=""
        onSourceChange={handleSourceChange}
      />
    );

    const input = screen.getByLabelText(/Source \/ list/i);
    await userEvent.click(input);

    const option = screen.getByRole("option", { name: "Blind 75" });
    fireEvent.mouseDown(option);

    expect(handleSourceChange).toHaveBeenCalledWith("Blind 75");
  });

  it("allows creating and adding a brand new source not in the list", async () => {
    const handleSourceChange = vi.fn();
    render(
      <LogExtraFields
        fields={[]}
        onFieldsChange={vi.fn()}
        values={{}}
        onValuesChange={vi.fn()}
        sources={["Blind 75", "NeetCode 150"]}
        source=""
        onSourceChange={handleSourceChange}
      />
    );

    const input = screen.getByLabelText(/Source \/ list/i);
    await userEvent.type(input, "Striver SDE Sheet{enter}");

    expect(handleSourceChange).toHaveBeenCalledWith("Striver SDE Sheet");
  });

  it("allows adding another source when one already exists", async () => {
    function ControlledForm() {
      const [src, setSrc] = useState("Blind 75");
      return (
        <LogExtraFields
          fields={[]}
          onFieldsChange={vi.fn()}
          values={{}}
          onValuesChange={vi.fn()}
          sources={["Blind 75", "NeetCode 150", "Striver SDE"]}
          source={src}
          onSourceChange={setSrc}
        />
      );
    }

    render(<ControlledForm />);

    expect(screen.getByText("Blind 75")).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Add another/i);
    await userEvent.type(input, "NeetCode 150{enter}");

    expect(screen.getByText("Blind 75")).toBeInTheDocument();
    expect(screen.getByText("NeetCode 150")).toBeInTheDocument();
  });

  it("allows removing a source tag", async () => {
    const handleSourceChange = vi.fn();
    render(
      <LogExtraFields
        fields={[]}
        onFieldsChange={vi.fn()}
        values={{}}
        onValuesChange={vi.fn()}
        sources={["Blind 75", "NeetCode 150"]}
        source="Blind 75, NeetCode 150"
        onSourceChange={handleSourceChange}
      />
    );

    expect(screen.getByText("Blind 75")).toBeInTheDocument();
    expect(screen.getByText("NeetCode 150")).toBeInTheDocument();

    const removeBlind75 = screen.getByRole("button", { name: /Remove source Blind 75/i });
    await userEvent.click(removeBlind75);

    expect(handleSourceChange).toHaveBeenCalledWith("NeetCode 150");
  });

  it("splits comma-separated text into multiple tags", async () => {
    const handleSourceChange = vi.fn();
    render(
      <LogExtraFields
        fields={[]}
        onFieldsChange={vi.fn()}
        values={{}}
        onValuesChange={vi.fn()}
        sources={[]}
        source=""
        onSourceChange={handleSourceChange}
      />
    );

    const input = screen.getByLabelText(/Source \/ list/i);
    await userEvent.type(input, "Blind 75,");

    expect(handleSourceChange).toHaveBeenCalledWith("Blind 75");
  });

  it("moves through suggestions with the arrow keys and picks one with Enter", async () => {
    const handleSourceChange = vi.fn();
    render(
      <LogExtraFields
        fields={[]}
        onFieldsChange={vi.fn()}
        values={{}}
        onValuesChange={vi.fn()}
        sources={["Blind 75", "NeetCode 150", "Striver SDE"]}
        source=""
        onSourceChange={handleSourceChange}
      />
    );

    const input = screen.getByLabelText(/Source \/ list/i);
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");

    expect(input).toHaveAttribute("aria-activedescendant", "log-source-option-1");
    expect(screen.getByRole("option", { name: "NeetCode 150" })).toHaveAttribute("aria-selected", "true");

    // Arrowing through options explores them without changing the value.
    expect(handleSourceChange).not.toHaveBeenCalled();
  });

  it("commits the highlighted suggestion on Enter after typing", async () => {
    const handleSourceChange = vi.fn();
    render(
      <LogExtraFields
        fields={[]}
        onFieldsChange={vi.fn()}
        values={{}}
        onValuesChange={vi.fn()}
        sources={["Blind 75", "NeetCode 150"]}
        source=""
        onSourceChange={handleSourceChange}
      />
    );

    await userEvent.type(screen.getByLabelText(/Source \/ list/i), "neet{ArrowDown}{Enter}");
    expect(handleSourceChange).toHaveBeenCalledWith("NeetCode 150");
  });

  it("turns off the browser's own autofill list so only ours shows", () => {
    render(
      <LogExtraFields
        fields={[]}
        onFieldsChange={vi.fn()}
        values={{}}
        onValuesChange={vi.fn()}
        sources={["Blind 75"]}
        source=""
        onSourceChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/Source \/ list/i)).toHaveAttribute("autocomplete", "off");
  });
});
