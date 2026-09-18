import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HealthPage } from "./HealthPage";
import * as client from "../api/client";

function mockHealthFailure(error: unknown) {
  vi.spyOn(client, "fetchHealth").mockRejectedValue(error);
}

describe("HealthPage", () => {
  it("shows backend and database status when healthy", async () => {
    vi.spyOn(client, "fetchHealth").mockResolvedValue({ status: "ok", database: "ok" });

    render(<HealthPage />);

    const markers = await screen.findAllByText("ok", { selector: "strong" });
    expect(markers).toHaveLength(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/^Service Status$/);
    expect(screen.queryByText("dark-factory-product-1")).not.toBeInTheDocument();
  });

  it("reports the database as unavailable when readiness answers 503", async () => {
    mockHealthFailure(new client.ApiError(503, "database unavailable"));

    render(<HealthPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Database unavailable: database unavailable (status 503)");
    expect(alert).toHaveTextContent("database unavailable");
    expect(alert).toHaveTextContent("(status 503)");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("classifies 503 by status, not by the error detail", async () => {
    mockHealthFailure(new client.ApiError(503, "connection refused"));

    render(<HealthPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Database unavailable: connection refused (status 503)",
    );
  });

  it("keeps the backend wording for other error statuses", async () => {
    mockHealthFailure(new client.ApiError(500, "boom"));

    render(<HealthPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend unavailable: boom (status 500)",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps the backend wording for a 502 response", async () => {
    mockHealthFailure(new client.ApiError(502, "bad gateway"));

    render(<HealthPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend unavailable: bad gateway (status 502)",
    );
  });

  it("shows an alert with a retry action when the backend is unreachable", async () => {
    mockHealthFailure(new client.ApiError(0, "The API is unreachable"));

    render(<HealthPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend unavailable: The API is unreachable (status 0)",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps the backend wording for non-ApiError failures", async () => {
    mockHealthFailure(new TypeError("fetch failed"));

    render(<HealthPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Backend unavailable: TypeError: fetch failed",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/^Service Status$/);
    expect(screen.queryByText("dark-factory-product-1")).not.toBeInTheDocument();
  });
});
