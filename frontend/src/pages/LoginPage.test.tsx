import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/pages/LoginPage";

const mutate = vi.fn();
const navigate = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useLogin: () => ({
    mutate,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ state: null, pathname: "/" }),
  };
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LoginPage", () => {
  it("renders the sign-in form and demo accounts", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByText(/demo accounts/i)).toBeInTheDocument();
  });

  it("fills credentials from a demo account chip and submits", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /maya/i }));
    expect(screen.getByLabelText(/username/i)).toHaveValue("maya");
    expect(screen.getByLabelText(/password/i)).toHaveValue("smartdesk123");

    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(mutate).toHaveBeenCalledWith(
      { username: "maya", password: "smartdesk123" },
      expect.anything(),
    );
  });
});
