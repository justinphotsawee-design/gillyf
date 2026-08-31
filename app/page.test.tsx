import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const { default: Welcome } = await import("./page");

describe("Welcome (\"/\")", () => {
  beforeEach(() => {
    pushMock.mockReset();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("shows a validation error and does not navigate when the name is empty", () => {
    render(<Welcome />);
    fireEvent.click(screen.getByRole("button", { name: /start customizing/i }));
    expect(screen.getByText("Please enter your name.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the validation error for whitespace-only input (trimmed to empty)", () => {
    render(<Welcome />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /start customizing/i }));
    expect(screen.getByText("Please enter your name.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("saves the trimmed name and navigates to /customize on valid submit", () => {
    render(<Welcome />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "  ต้นข้าว  " } });
    fireEvent.click(screen.getByRole("button", { name: /start customizing/i }));

    expect(pushMock).toHaveBeenCalledWith("/customize");
    expect(JSON.parse(window.sessionStorage.getItem("gilly:customer")!)).toEqual({
      name: "ต้นข้าว",
    });
  });

  it("clears any design left over from a previous customer on this device", () => {
    window.localStorage.setItem(
      "gilly:design",
      JSON.stringify({ uploadedUrls: { coverFront: "x" }, adjustments: {} })
    );
    render(<Welcome />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: /start customizing/i }));
    expect(window.localStorage.getItem("gilly:design")).toBeNull();
  });

  it("submits via Enter in the name field, same as clicking the button", () => {
    render(<Welcome />);
    const input = screen.getByLabelText(/name/i);
    fireEvent.change(input, { target: { value: "Alex" } });
    fireEvent.submit(input.closest("form")!);
    expect(pushMock).toHaveBeenCalledWith("/customize");
  });

  it("clears a previous error once a name is entered and resubmitted", () => {
    render(<Welcome />);
    fireEvent.click(screen.getByRole("button", { name: /start customizing/i }));
    expect(screen.getByText("Please enter your name.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: /start customizing/i }));
    expect(screen.queryByText("Please enter your name.")).not.toBeInTheDocument();
  });
});
