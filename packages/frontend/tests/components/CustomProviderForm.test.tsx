import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";

const mockCreateCustomProvider = vi.fn();
const mockUpdateCustomProvider = vi.fn();
const mockDeleteCustomProvider = vi.fn();

vi.mock("../../src/services/api.js", () => ({
  createCustomProvider: (...args: unknown[]) => mockCreateCustomProvider(...args),
  updateCustomProvider: (...args: unknown[]) => mockUpdateCustomProvider(...args),
  deleteCustomProvider: (...args: unknown[]) => mockDeleteCustomProvider(...args),
}));

vi.mock("../../src/services/toast-store.js", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import CustomProviderForm from "../../src/components/CustomProviderForm";
import { toast } from "../../src/services/toast-store.js";

describe("CustomProviderForm", () => {
  const onCreated = vi.fn();
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCustomProvider.mockResolvedValue({
      id: "cp-1",
      name: "Groq",
      base_url: "https://api.groq.com/openai/v1",
      has_api_key: true,
      models: [{ model_name: "llama-3.1-70b" }],
      created_at: "2026-03-04T00:00:00Z",
    });
    mockUpdateCustomProvider.mockResolvedValue({
      id: "cp-1",
      name: "Updated Groq",
      base_url: "https://api.groq.com/openai/v1",
      has_api_key: true,
      models: [{ model_name: "llama-3.1-70b" }],
      created_at: "2026-03-04T00:00:00Z",
    });
    mockDeleteCustomProvider.mockResolvedValue({ ok: true });
  });

  it("renders the form fields", () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));
    expect(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure")).toBeDefined();
    expect(screen.getByPlaceholderText("https://api.example.com/v1")).toBeDefined();
    expect(screen.getByPlaceholderText("sk-...")).toBeDefined();
    expect(screen.getByPlaceholderText("Model name")).toBeDefined();
  });

  it("Create button is disabled when required fields are empty", () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));
    const createBtn = screen.getByText("Create");
    expect(createBtn.hasAttribute("disabled")).toBe(true);
  });

  it("enables Create button when required fields are filled", async () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));
    const nameInput = screen.getByPlaceholderText("e.g. Groq, vLLM, Azure");
    const urlInput = screen.getByPlaceholderText("https://api.example.com/v1");
    const modelInput = screen.getByPlaceholderText("Model name");

    fireEvent.input(nameInput, { target: { value: "Groq" } });
    fireEvent.input(urlInput, { target: { value: "https://api.groq.com/v1" } });
    fireEvent.input(modelInput, { target: { value: "llama-3.1-70b" } });

    await waitFor(() => {
      expect(screen.getByText("Create").hasAttribute("disabled")).toBe(false);
    });
  });

  it("calls createCustomProvider and onCreated on submit", async () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "Groq" },
    });
    fireEvent.input(screen.getByPlaceholderText("https://api.example.com/v1"), {
      target: { value: "https://api.groq.com/v1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Model name"), {
      target: { value: "llama-3.1-70b" },
    });

    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockCreateCustomProvider).toHaveBeenCalledWith("test-agent", {
        name: "Groq",
        base_url: "https://api.groq.com/v1",
        apiKey: undefined,
        models: [{ model_name: "llama-3.1-70b" }],
      });
      expect(toast.success).toHaveBeenCalledWith("Groq connected");
      expect(onCreated).toHaveBeenCalled();
    });
  });

  it("calls onBack when back button is clicked", () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));
    fireEvent.click(screen.getByLabelText("Back to providers"));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows error message on API failure", async () => {
    mockCreateCustomProvider.mockRejectedValue(new Error("Name already exists"));

    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "Groq" },
    });
    fireEvent.input(screen.getByPlaceholderText("https://api.example.com/v1"), {
      target: { value: "https://api.groq.com/v1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Model name"), {
      target: { value: "llama-3.1-70b" },
    });

    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(screen.getByText("Name already exists")).toBeDefined();
    });
  });

  it("submits with API key when provided", async () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "Groq" },
    });
    fireEvent.input(screen.getByPlaceholderText("https://api.example.com/v1"), {
      target: { value: "https://api.groq.com/v1" },
    });
    fireEvent.input(screen.getByPlaceholderText("sk-..."), {
      target: { value: "gsk_test123" },
    });
    fireEvent.input(screen.getByPlaceholderText("Model name"), {
      target: { value: "llama-3.1-70b" },
    });

    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockCreateCustomProvider).toHaveBeenCalledWith("test-agent", {
        name: "Groq",
        base_url: "https://api.groq.com/v1",
        apiKey: "gsk_test123",
        models: [{ model_name: "llama-3.1-70b" }],
      });
    });
  });

  it("submits with pricing fields when provided", async () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "Groq" },
    });
    fireEvent.input(screen.getByPlaceholderText("https://api.example.com/v1"), {
      target: { value: "https://api.groq.com/v1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Model name"), {
      target: { value: "llama-3.1-70b" },
    });
    fireEvent.input(screen.getByPlaceholderText("$/M in"), {
      target: { value: "0.59" },
    });
    fireEvent.input(screen.getByPlaceholderText("$/M out"), {
      target: { value: "0.79" },
    });

    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockCreateCustomProvider).toHaveBeenCalledWith("test-agent", {
        name: "Groq",
        base_url: "https://api.groq.com/v1",
        apiKey: undefined,
        models: [
          {
            model_name: "llama-3.1-70b",
            input_price_per_million_tokens: 0.59,
            output_price_per_million_tokens: 0.79,
          },
        ],
      });
    });
  });

  it("converts comma decimal separators to dots in pricing fields", async () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "Groq" },
    });
    fireEvent.input(screen.getByPlaceholderText("https://api.example.com/v1"), {
      target: { value: "https://api.groq.com/v1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Model name"), {
      target: { value: "llama-3.1-70b" },
    });
    fireEvent.input(screen.getByPlaceholderText("$/M in"), {
      target: { value: "0,59" },
    });
    fireEvent.input(screen.getByPlaceholderText("$/M out"), {
      target: { value: "0,79" },
    });

    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockCreateCustomProvider).toHaveBeenCalledWith("test-agent", {
        name: "Groq",
        base_url: "https://api.groq.com/v1",
        apiKey: undefined,
        models: [
          {
            model_name: "llama-3.1-70b",
            input_price_per_million_tokens: 0.59,
            output_price_per_million_tokens: 0.79,
          },
        ],
      });
    });
  });

  it("shows generic error message for non-Error exceptions", async () => {
    mockCreateCustomProvider.mockRejectedValue("string error");

    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "Test" },
    });
    fireEvent.input(screen.getByPlaceholderText("https://api.example.com/v1"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Model name"), {
      target: { value: "model" },
    });

    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(screen.getByText("Failed to create provider")).toBeDefined();
    });
  });

  it("clears error when name input changes", async () => {
    mockCreateCustomProvider.mockRejectedValue(new Error("Some error"));

    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "Test" },
    });
    fireEvent.input(screen.getByPlaceholderText("https://api.example.com/v1"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Model name"), {
      target: { value: "model" },
    });

    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(screen.getByText("Some error")).toBeDefined();
    });

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "New Name" },
    });
    await waitFor(() => {
      expect(screen.queryByText("Some error")).toBeNull();
    });
  });

  it("clears error when base URL input changes", async () => {
    mockCreateCustomProvider.mockRejectedValue(new Error("URL error"));

    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "Test" },
    });
    fireEvent.input(screen.getByPlaceholderText("https://api.example.com/v1"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Model name"), {
      target: { value: "model" },
    });

    fireEvent.click(screen.getByText("Create"));
    await waitFor(() => {
      expect(screen.getByText("URL error")).toBeDefined();
    });

    fireEvent.input(screen.getByPlaceholderText("https://api.example.com/v1"), {
      target: { value: "http://localhost:8000" },
    });
    await waitFor(() => {
      expect(screen.queryByText("URL error")).toBeNull();
    });
  });

  it("remove button is disabled when only one model row exists", () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));
    const removeBtn = screen.getByLabelText("Remove model 1");
    expect(removeBtn.hasAttribute("disabled")).toBe(true);
  });

  it("does not remove last model row when clicking remove", async () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    const removeBtn = screen.getByLabelText("Remove model 1");
    fireEvent.click(removeBtn);

    expect(screen.getAllByPlaceholderText("Model name")).toHaveLength(1);
  });

  it("shows Creating... text while submitting", async () => {
    let resolveSubmit: (v: unknown) => void;
    mockCreateCustomProvider.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );

    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "Test" },
    });
    fireEvent.input(screen.getByPlaceholderText("https://api.example.com/v1"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.input(screen.getByPlaceholderText("Model name"), {
      target: { value: "model" },
    });

    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      const btn = document.querySelector("button.btn--primary") as HTMLButtonElement;
      expect(btn.querySelector(".spinner")).not.toBeNull();
    });

    resolveSubmit!({
      id: "cp-1",
      name: "Test",
      base_url: "https://api.example.com/v1",
      has_api_key: false,
      models: [{ model_name: "model" }],
      created_at: "2026-03-04T00:00:00Z",
    });
  });

  it("filters out empty model names on submit", async () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    const modelInput = screen.getByPlaceholderText("Model name");
    fireEvent.input(modelInput, { target: { value: "model-a" } });

    const addBtn = screen.getByText("+ Add model");
    await waitFor(() => expect(addBtn.hasAttribute("disabled")).toBe(false));
    fireEvent.click(addBtn);

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "Test" },
    });
    fireEvent.input(screen.getByPlaceholderText("https://api.example.com/v1"), {
      target: { value: "https://api.example.com/v1" },
    });

    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockCreateCustomProvider).toHaveBeenCalledWith("test-agent", {
        name: "Test",
        base_url: "https://api.example.com/v1",
        apiKey: undefined,
        models: [{ model_name: "model-a" }],
      });
    });
  });

  it("adds and removes model rows", async () => {
    render(() => (
      <CustomProviderForm agentName="test-agent" onCreated={onCreated} onBack={onBack} />
    ));

    const modelInput = screen.getByPlaceholderText("Model name");
    fireEvent.input(modelInput, { target: { value: "model-a" } });

    const addBtn = screen.getByText("+ Add model");
    await waitFor(() => expect(addBtn.hasAttribute("disabled")).toBe(false));
    fireEvent.click(addBtn);

    await waitFor(() => {
      const inputs = screen.getAllByPlaceholderText("Model name");
      expect(inputs).toHaveLength(2);
    });

    // Remove the second one
    const removeBtns = screen.getAllByTitle("Remove");
    fireEvent.click(removeBtns[1]);

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText("Model name")).toHaveLength(1);
    });
  });
});

describe("CustomProviderForm — edit mode", () => {
  const onCreated = vi.fn();
  const onBack = vi.fn();
  const onDeleted = vi.fn();

  const initialData = {
    id: "cp-1",
    name: "Groq",
    base_url: "https://api.groq.com/openai/v1",
    has_api_key: true,
    models: [
      {
        model_name: "llama-3.1-70b",
        input_price_per_million_tokens: 0.59,
        output_price_per_million_tokens: 0.79,
      },
    ],
    created_at: "2026-03-04T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateCustomProvider.mockResolvedValue({ ...initialData, name: "Updated" });
    mockDeleteCustomProvider.mockResolvedValue({ ok: true });
  });

  it("renders with pre-populated fields", () => {
    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        initialData={initialData}
      />
    ));

    expect(screen.getByText("Edit custom provider")).toBeDefined();
    expect(screen.getByText("Save changes")).toBeDefined();
    expect((screen.getByPlaceholderText("e.g. Groq, vLLM, Azure") as HTMLInputElement).value).toBe("Groq");
    expect((screen.getByPlaceholderText("https://api.example.com/v1") as HTMLInputElement).value).toBe("https://api.groq.com/openai/v1");
  });

  it("shows masked API key with Change button", () => {
    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        initialData={initialData}
      />
    ));

    expect(screen.getByDisplayValue("••••••••••••")).toBeDefined();
    expect(screen.getByText("Change")).toBeDefined();
  });

  it("shows 'No key set' when has_api_key is false", () => {
    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        initialData={{ ...initialData, has_api_key: false }}
      />
    ));

    expect(screen.getByDisplayValue("No key set")).toBeDefined();
  });

  it("reveals API key input when Change is clicked", async () => {
    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        initialData={initialData}
      />
    ));

    fireEvent.click(screen.getByText("Change"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("sk-...")).toBeDefined();
    });
  });

  it("calls updateCustomProvider on submit", async () => {
    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        initialData={initialData}
      />
    ));

    fireEvent.input(screen.getByPlaceholderText("e.g. Groq, vLLM, Azure"), {
      target: { value: "Updated Groq" },
    });

    fireEvent.click(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockUpdateCustomProvider).toHaveBeenCalledWith("test-agent", "cp-1", {
        name: "Updated Groq",
        base_url: "https://api.groq.com/openai/v1",
        models: [
          {
            model_name: "llama-3.1-70b",
            input_price_per_million_tokens: 0.59,
            output_price_per_million_tokens: 0.79,
          },
        ],
      });
      expect(toast.success).toHaveBeenCalledWith("Updated Groq updated");
      expect(onCreated).toHaveBeenCalled();
    });
  });

  it("includes apiKey in payload when key is changed", async () => {
    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        initialData={initialData}
      />
    ));

    fireEvent.click(screen.getByText("Change"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("sk-...")).toBeDefined();
    });

    fireEvent.input(screen.getByPlaceholderText("sk-..."), {
      target: { value: "new-key-123" },
    });

    fireEvent.click(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockUpdateCustomProvider).toHaveBeenCalledWith("test-agent", "cp-1", {
        name: "Groq",
        base_url: "https://api.groq.com/openai/v1",
        apiKey: "new-key-123",
        models: [
          {
            model_name: "llama-3.1-70b",
            input_price_per_million_tokens: 0.59,
            output_price_per_million_tokens: 0.79,
          },
        ],
      });
    });
  });

  it("shows Delete provider button", () => {
    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        onDeleted={onDeleted}
        initialData={initialData}
      />
    ));

    expect(screen.getByText("Delete provider")).toBeDefined();
  });

  it("calls deleteCustomProvider and onDeleted on delete", async () => {
    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        onDeleted={onDeleted}
        initialData={initialData}
      />
    ));

    // Click "Delete provider" to open confirmation modal
    fireEvent.click(screen.getByText("Delete provider"));

    // Click "Delete" in the confirmation modal
    await waitFor(() => {
      const deleteBtn = screen.getByText("Delete");
      expect(deleteBtn).toBeDefined();
    });
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(mockDeleteCustomProvider).toHaveBeenCalledWith("test-agent", "cp-1");
      expect(toast.success).toHaveBeenCalledWith("Groq removed");
      expect(onDeleted).toHaveBeenCalled();
    });
  });

  it("handles delete error gracefully", async () => {
    mockDeleteCustomProvider.mockRejectedValue(new Error("delete failed"));

    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        onDeleted={onDeleted}
        initialData={initialData}
      />
    ));

    // Click "Delete provider" to open confirmation modal
    fireEvent.click(screen.getByText("Delete provider"));

    // Click "Delete" in the confirmation modal
    await waitFor(() => {
      const deleteBtn = screen.getByText("Delete");
      expect(deleteBtn).toBeDefined();
    });
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(mockDeleteCustomProvider).toHaveBeenCalledWith("test-agent", "cp-1");
    });
    // Should not throw, should not call onDeleted
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("does not delete when confirm is cancelled", async () => {
    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        onDeleted={onDeleted}
        initialData={initialData}
      />
    ));

    // Click "Delete provider" to open confirmation modal
    fireEvent.click(screen.getByText("Delete provider"));

    // Click "Cancel" in the confirmation modal
    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Cancel"));

    expect(mockDeleteCustomProvider).not.toHaveBeenCalled();
  });

  it("shows Saving... text while submitting", async () => {
    let resolveSubmit: (v: unknown) => void;
    mockUpdateCustomProvider.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );

    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        initialData={initialData}
      />
    ));

    fireEvent.click(screen.getByText("Save changes"));

    await waitFor(() => {
      const btn = document.querySelector("button.btn--primary") as HTMLButtonElement;
      expect(btn.querySelector(".spinner")).not.toBeNull();
    });

    resolveSubmit!({ ...initialData });
  });

  it("shows error on update failure", async () => {
    mockUpdateCustomProvider.mockRejectedValue(new Error("Update failed"));

    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        initialData={initialData}
      />
    ));

    fireEvent.click(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(screen.getByText("Update failed")).toBeDefined();
    });
  });

  it("shows generic error message for non-Error exceptions on update", async () => {
    mockUpdateCustomProvider.mockRejectedValue("string error");

    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        initialData={initialData}
      />
    ));

    fireEvent.click(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(screen.getByText("Failed to update provider")).toBeDefined();
    });
  });

  it("pre-populates model rows from initialData", () => {
    render(() => (
      <CustomProviderForm
        agentName="test-agent"
        onCreated={onCreated}
        onBack={onBack}
        initialData={initialData}
      />
    ));

    const modelInput = screen.getByLabelText("Model 1 name") as HTMLInputElement;
    expect(modelInput.value).toBe("llama-3.1-70b");
  });
});
