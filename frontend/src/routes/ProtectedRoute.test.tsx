import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { useAuthStore } from "@/stores/auth";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="redirect" data-to={to} />,
  };
});

describe("ProtectedRoute", () => {
  it("redirects unauthenticated visitors to /login", () => {
    useAuthStore.setState({ accessToken: null, refresh: null, user: null });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>secret</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("redirect")).toHaveAttribute("data-to", "/login");
  });

  it("blocks roles outside the allow-list", () => {
    useAuthStore.setState({
      accessToken: "t",
      refresh: "r",
      user: {
        id: 1,
        username: "cust",
        email: "c@example.com",
        first_name: "",
        last_name: "",
        role: "CUSTOMER",
        team: null,
        tier: "standard",
        title: "",
        skills: [],
        avatar_url: "",
      },
    });
    render(
      <MemoryRouter>
        <ProtectedRoute roles={["ADMIN"]}>
          <div>secret</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
  });

  it("renders children for an authorised role", () => {
    useAuthStore.setState({
      accessToken: "t",
      refresh: "r",
      user: {
        id: 2,
        username: "admin",
        email: "a@example.com",
        first_name: "",
        last_name: "",
        role: "ADMIN",
        team: null,
        tier: "enterprise",
        title: "",
        skills: [],
        avatar_url: "",
      },
    });
    render(
      <MemoryRouter>
        <ProtectedRoute roles={["ADMIN"]}>
          <div>secret</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText("secret")).toBeInTheDocument();
  });
});
