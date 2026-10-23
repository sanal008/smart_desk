import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { ConfidenceBar, StatCard } from "@/components/ui/Card";

describe("Badge", () => {
  it("renders children with the requested tone class", () => {
    render(<Badge tone="danger">Urgent</Badge>);
    expect(screen.getByText("Urgent")).toHaveClass("rounded-full");
  });
});

describe("PriorityBadge", () => {
  it("shows the AI marker when the priority was model-suggested", () => {
    render(<PriorityBadge priority="URGENT" aiSuggested />);
    expect(screen.getByText("URGENT")).toBeInTheDocument();
    expect(screen.getByTitle(/suggested by ai/i)).toBeInTheDocument();
  });

  it("omits the AI marker otherwise", () => {
    render(<PriorityBadge priority="LOW" />);
    expect(screen.queryByTitle(/suggested by ai/i)).not.toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("humanises status labels", () => {
    render(<StatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });
});

describe("StatCard", () => {
  it("renders label, value and hint", () => {
    render(<StatCard label="Open tickets" value={42} hint="3 unassigned" />);
    expect(screen.getByText("Open tickets")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("3 unassigned")).toBeInTheDocument();
  });
});

describe("ConfidenceBar", () => {
  it("renders a percentage label", () => {
    render(<ConfidenceBar value={0.87} />);
    expect(screen.getByText("87%")).toBeInTheDocument();
  });
});
