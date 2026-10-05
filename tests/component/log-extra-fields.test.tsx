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
        showSource={true}
        onShowSource={vi.fn()}
        source=""
        onSourceChange={handleSourceChange}
      />
    );

    const input = screen.getByLabelText(/Source \/ list/i);
    expect(input).toBeInTheDocument();

    await userEvent.click(input);

    expect(screen.getByRole("button", { name: "Blind 75" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "NeetCode 150" })).toBeInTheDocument();
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
        showSource={true}
        onShowSource={vi.fn()}
        source=""
        onSourceChange={handleSourceChange}
      />
    );

    const input = screen.getByLabelText(/Source \/ list/i);
    await userEvent.click(input);

    const option = screen.getByRole("button", { name: "Blind 75" });
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
        showSource={true}
        onShowSource={vi.fn()}
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
          showSource={true}
          onShowSource={vi.fn()}
          source={src}
          onSourceChange={setSrc}
        />
      );
    }

    render(<ControlledForm />);

    expect(screen.getByText("Blind 75")).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Add another source/i);
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
        showSource={true}
        onShowSource={vi.fn()}
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
        showSource={true}
        onShowSource={vi.fn()}
        source=""
        onSourceChange={handleSourceChange}
      />
    );

    const input = screen.getByLabelText(/Source \/ list/i);
    await userEvent.type(input, "Blind 75,");

    expect(handleSourceChange).toHaveBeenCalledWith("Blind 75");
  });
});
