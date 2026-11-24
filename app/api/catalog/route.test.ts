import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  eqActive: vi.fn(),
  eqUser: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mocks.from, rpc: mocks.rpc },
  supabaseAuth: { auth: { getUser: mocks.getUser } },
}));

import { PATCH, POST } from "./route";

const productBody = {
  id: "summer-set",
  name: "Summer set",
  category: "Sets",
  price: 2500,
  description: "A lightweight set.",
  image: "https://example.com/summer-set.jpg",
  imageAlt: "A child wearing a summer set",
  variants: [{ label: "2 - 3 yrs", color: "Sand", stock: 4 }],
};

function makeRequest(method: "POST" | "PATCH", body?: unknown, token = "valid-token") {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("authorization", `Bearer ${token}`);
  return new Request("http://localhost/api/catalog", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function responseBody(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("catalog mutation authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "staff-user" } }, error: null });
    mocks.maybeSingle.mockResolvedValue({ data: { role: "staff", active: true }, error: null });
    mocks.eqActive.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.eqUser.mockReturnValue({ eq: mocks.eqActive });
    mocks.select.mockReturnValue({ eq: mocks.eqUser });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("rejects a catalog write without a bearer token", async () => {
    const response = await POST(makeRequest("POST", productBody, ""));

    expect(response.status).toBe(401);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user without active staff membership", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await PATCH(makeRequest("PATCH", {
      id: "summer-set",
      price: 2500,
      variants: [{ id: "summer-set-variant-1", stock: 4 }],
    }));

    expect(response.status).toBe(403);
    expect(mocks.from).toHaveBeenCalledWith("staff_members");
    expect(mocks.eqUser).toHaveBeenCalledWith("user_id", "staff-user");
    expect(mocks.eqActive).toHaveBeenCalledWith("active", true);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed or unsafe product fields before writing", async () => {
    const response = await POST(makeRequest("POST", {
      ...productBody,
      image: "javascript:alert(1)",
      price: -1,
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("creates a product and all variants with one atomic database call", async () => {
    const response = await POST(makeRequest("POST", productBody));
    const body = await responseBody(response);

    expect(response.status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("create_product_with_variants", expect.objectContaining({
      p_id: "summer-set",
      p_variants: [{
        id: "summer-set-variant-1",
        label: "2 - 3 yrs",
        color: "Sand",
        stock: 4,
      }],
    }));
    expect(body.product).toBeDefined();
  });

  it("updates price and variant stock in one atomic database call", async () => {
    const response = await PATCH(makeRequest("PATCH", {
      id: "summer-set",
      price: 2600,
      variants: [
        { id: "summer-set-2-3", stock: 2 },
        { id: "summer-set-4-6", stock: 5 },
      ],
    }));

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("update_product_inventory", {
      p_id: "summer-set",
      p_price: 2600,
      p_variants: [
        { id: "summer-set-2-3", stock: 2 },
        { id: "summer-set-4-6", stock: 5 },
      ],
    });
  });

  it("returns a conflict when the database rejects a duplicate product or variant ID", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    const response = await POST(makeRequest("POST", productBody));

    expect(response.status).toBe(409);
    expect(await responseBody(response)).toEqual({ error: "A product or variant with that ID already exists." });
  });

  it("reports a mismatched variant update without returning a success response", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "variant does not belong to product" } });

    const response = await PATCH(makeRequest("PATCH", {
      id: "summer-set",
      price: 2500,
      variants: [{ id: "other-products-variant", stock: 4 }],
    }));

    expect(response.status).toBe(400);
    expect(await responseBody(response)).toEqual({ error: "A variant is invalid or does not belong to this product." });
  });
});
