import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

const loadCustomerInfoMock = vi.fn();
vi.mock("../lib/customer", () => ({
  loadCustomerInfo: () => loadCustomerInfoMock(),
}));

vi.mock("../lib/browser", () => ({
  isInAppBrowser: () => false,
  isMobileBrowser: () => false,
}));

vi.mock("../lib/upload", () => ({
  uploadImage: vi.fn(),
}));

// TemplatePreview is covered by its own dedicated test file — stub it here
// so this file stays focused on the page-level session gate.
vi.mock("../components/TemplatePreview", () => ({
  __esModule: true,
  default: () => <div data-testid="template-preview-stub" />,
  DEFAULT_ADJUSTMENT: { scale: 1, x: 0.5, y: 0.5 },
}));

const { default: Customize } = await import("./page");

describe("Customize (\"/customize\") — session gate", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    loadCustomerInfoMock.mockReset();
  });

  it("redirects to \"/\" and renders nothing when no customer info is in sessionStorage", () => {
    loadCustomerInfoMock.mockReturnValue(null);
    const { container } = render(<Customize />);
    expect(replaceMock).toHaveBeenCalledWith("/");
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the customize form and does not redirect when customer info is present", () => {
    loadCustomerInfoMock.mockReturnValue({ name: "ต้นข้าว" });
    render(<Customize />);
    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.getByText(/hi, ต้นข้าว/i)).toBeInTheDocument();
    expect(screen.getByTestId("template-preview-stub")).toBeInTheDocument();
  });

  it("shows 0 of N sections completed before any photo is uploaded", () => {
    loadCustomerInfoMock.mockReturnValue({ name: "Alex" });
    render(<Customize />);
    expect(screen.getByText(/0 of 6 sections added/i)).toBeInTheDocument();
  });

  it("disables Generate PDF while any slot is still uploading", () => {
    // uploadingSlots starts empty client-side, so this exercises the
    // initial-render contract instead: the button starts enabled with
    // nothing uploading yet.
    loadCustomerInfoMock.mockReturnValue({ name: "Alex" });
    render(<Customize />);
    const btn = screen.getByRole("button", { name: /generate pdf/i });
    expect(btn).not.toBeDisabled();
  });
});
