"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { categories, type Category, type Product } from "@/lib/catalog";
import { browserSupabase } from "@/lib/supabase";

type ProductDraft = { id: string; name: string; category: Exclude<Category, "All items">; price: number; description: string; image: string; imageAlt: string; variants: Product["variants"] };
type StaffAccess = { status: "checking" | "allowed" | "denied" | "error"; message?: string };
type StaffMember = { user_id: string; role: "admin" | "staff"; active: boolean; created_at?: string };
const emptyDraft: ProductDraft = { id: "", name: "", category: "Everyday wear", price: 0, description: "", image: "", imageAlt: "", variants: [{ id: "", label: "", color: "", stock: 0 }] };

export default function StaffPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [source, setSource] = useState("loading");
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [staffAccess, setStaffAccess] = useState<StaffAccess>({ status: "checking" });
  const [staffRole, setStaffRole] = useState<"admin" | "staff" | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "staff">("staff");
  const [syncRuns, setSyncRuns] = useState<Array<{ id: number; status: string; started_at: string; completed_at?: string; product_count: number; variant_count: number; error?: string }>>([]);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [authMessage, setAuthMessage] = useState("");

  useEffect(() => {
    if (!browserSupabase) {
      setAuthLoading(false);
      setSource("demo");
      setMessage("Configure Supabase in .env.local to enable staff sign-in.");
      return;
    }

    browserSupabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setAuthLoading(false);
    });

    const { data: { subscription } } = browserSupabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setStaffAccess({ status: "denied" });
      return;
    }

    let cancelled = false;
    setStaffAccess({ status: "checking" });

    const checkStaffAccess = async () => {
      try {
        const response = await fetch("/api/staff/me", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await response.json() as { error?: string; role?: "admin" | "staff" };
        if (cancelled) return;
        if (!response.ok) {
          setStaffAccess({ status: "denied", message: data.error ?? "You do not have staff access." });
          return;
        }
        setStaffAccess({ status: "allowed" });
        setStaffRole(data.role ?? "staff");
      } catch {
        if (!cancelled) setStaffAccess({ status: "error", message: "Could not verify staff access. Please try again." });
      }
    };

    void checkStaffAccess();
    return () => { cancelled = true; };
  }, [session]);

  const loadProducts = async () => {
    const response = await fetch("/api/catalog");
    const data = await response.json() as { products?: Product[]; source?: string; error?: string };
    setProducts(data.products ?? []);
    setSource(data.source ?? "demo");
    if (data.error) setMessage(data.error);
  };

  const loadAdminTools = async () => {
    if (staffRole !== "admin") return;
    try {
      const [membersResponse, syncResponse] = await Promise.all([
        fetchWithSession("/api/staff/members"),
        fetchWithSession("/api/staff/sheets/sync"),
      ]);
      const membersData = await membersResponse.json() as { members?: StaffMember[] };
      const syncData = await syncResponse.json() as { sync_runs?: typeof syncRuns };
      setStaffMembers(membersData.members ?? []);
      setSyncRuns(syncData.sync_runs ?? []);
    } catch {
      setMessage("Could not load administrator tools.");
    }
  };

  useEffect(() => {
    if (staffAccess.status === "allowed" && staffRole === "admin") void loadAdminTools();
  // loadAdminTools is intentionally refreshed only when staff access or role changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffAccess.status, staffRole]);

  useEffect(() => {
    if (!session || staffAccess.status !== "allowed") {
      setProducts([]);
      setSource("demo");
      return;
    }

    void loadProducts();
  }, [session, staffAccess.status]);

  const fetchWithSession = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!browserSupabase) {
      throw new Error("Supabase is not configured.");
    }

    const { data: { session: currentSession } } = await browserSupabase.auth.getSession();
    if (!currentSession) {
      throw new Error("Please sign in to continue.");
    }

    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${currentSession.access_token}`);
    headers.set("Content-Type", "application/json");

    return fetch(input, { ...init, headers });
  };

  const updateProduct = async (product: Product) => {
    try {
      const response = await fetchWithSession("/api/catalog", {
        method: "PATCH",
        body: JSON.stringify(product),
      });
      const data = await response.json() as { error?: string };
      setMessage(response.ok ? `${product.name} updated.` : data.error ?? "Update failed.");
      if (response.ok) await loadProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    try {
      const response = await fetchWithSession("/api/catalog", {
        method: "DELETE",
        body: JSON.stringify({ id: product.id }),
      });
      const data = await response.json() as { error?: string };
      setMessage(response.ok ? `${product.name} deleted.` : data.error ?? "Delete failed.");
      if (response.ok) await loadProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    }
  };

  const provisionMember = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetchWithSession("/api/staff/members", {
        method: "POST",
        body: JSON.stringify({ email: memberEmail, role: memberRole }),
      });
      const data = await response.json() as { error?: string };
      setMessage(response.ok ? "Staff invitation created." : data.error ?? "Could not provision staff.");
      if (response.ok) {
        setMemberEmail("");
        await loadAdminTools();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not provision staff.");
    }
  };

  const updateMember = async (member: StaffMember, updates: { role?: "admin" | "staff"; active?: boolean }) => {
    const response = await fetchWithSession("/api/staff/members", {
      method: "PATCH",
      body: JSON.stringify({ user_id: member.user_id, ...updates }),
    });
    const data = await response.json() as { error?: string };
    setMessage(response.ok ? "Staff member updated." : data.error ?? "Could not update staff member.");
    if (response.ok) await loadAdminTools();
  };

  const removeMember = async (member: StaffMember) => {
    if (!window.confirm(`Remove staff access for ${member.user_id}?`)) return;
    const response = await fetchWithSession("/api/staff/members", {
      method: "DELETE",
      body: JSON.stringify({ user_id: member.user_id }),
    });
    const data = await response.json() as { error?: string };
    setMessage(response.ok ? "Staff access removed." : data.error ?? "Could not remove staff member.");
    if (response.ok) await loadAdminTools();
  };

  const syncSheets = async () => {
    try {
      const response = await fetchWithSession("/api/staff/sheets/sync", { method: "POST" });
      const data = await response.json() as { error?: string };
      setMessage(response.ok ? "Google Sheets catalog synchronized." : data.error ?? "Sheets sync failed.");
      if (response.ok) {
        await Promise.all([loadProducts(), loadAdminTools()]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sheets sync failed.");
    }
  };

  const addProduct = async (event: FormEvent) => {
    event.preventDefault();

    try {
      const response = await fetchWithSession("/api/catalog", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      const data = await response.json() as { error?: string };
      setMessage(response.ok ? `${draft.name} added.` : data.error ?? "Could not add product.");
      if (response.ok) {
        setDraft(emptyDraft);
        await loadProducts();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add product.");
    }
  };

  const handleAuthSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!browserSupabase) {
      setAuthMessage("Configure Supabase to enable staff sign-in.");
      return;
    }

    try {
      const { error } = await browserSupabase.auth.signInWithPassword({ email: credentials.email, password: credentials.password });
      if (error) throw error;

      setAuthMessage("Signed in successfully.");
      setCredentials({ email: "", password: "" });
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Authentication failed.");
    }
  };

  const handleSignOut = async () => {
    if (!browserSupabase) return;
    await browserSupabase.auth.signOut();
    setSession(null);
    setMessage("Signed out.");
  };

  const renderInventory = () => (
    <>
      <header className="staff-header">
        <div>
          <p className="eyebrow">ROMIBS Traders</p>
          <h1>Inventory desk</h1>
          <p>Update prices and stock, or add a new product.</p>
        </div>
        <div className="staff-header-actions">
          <button className="secondary-button" type="button" onClick={handleSignOut}>Sign out</button>
          <Link className="secondary-button" href="/">Return to shop</Link>
        </div>
      </header>
      <div className={source === "supabase" ? "staff-status connected" : "staff-status"}>{source === "supabase" ? "Connected to Supabase" : source === "demo" ? "Demo catalog: configure Supabase to enable live inventory edits." : "Catalog status"}</div>
      {message && <p className="staff-message">{message}</p>}
      <section className="staff-section">
        <div className="staff-section-heading">
          <div><p className="eyebrow">Existing products</p><h2>Prices and stock</h2></div>
          <span>{products.length} products</span>
        </div>
        <div className="inventory-list">{products.map((product) => <InventoryRow key={product.id} product={product} onSave={updateProduct} onDelete={deleteProduct} />)}</div>
      </section>
      {staffRole === "admin" && (
        <>
          <section className="staff-section">
            <div className="staff-section-heading"><div><p className="eyebrow">Administration</p><h2>Staff members</h2></div></div>
            <form className="staff-form" onSubmit={provisionMember}>
              <label>Email<input type="email" required value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} /></label>
              <label>Role<select value={memberRole} onChange={(event) => setMemberRole(event.target.value as "admin" | "staff")}><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
              <button className="primary-button" type="submit">Send staff invitation</button>
            </form>
            <div className="inventory-list">
              {staffMembers.map((member) => (
                <div className="inventory-row" key={member.user_id}>
                  <div><strong>{member.user_id}</strong><small>{member.active ? "Active" : "Inactive"}</small></div>
                  <select value={member.role} onChange={(event) => void updateMember(member, { role: event.target.value as "admin" | "staff" })}><option value="staff">Staff</option><option value="admin">Admin</option></select>
                  <button className="secondary-button" type="button" onClick={() => void updateMember(member, { active: !member.active })}>{member.active ? "Deactivate" : "Activate"}</button>
                  <button className="secondary-button" type="button" onClick={() => void removeMember(member)}>Remove</button>
                </div>
              ))}
            </div>
          </section>
          <section className="staff-section">
            <div className="staff-section-heading"><div><p className="eyebrow">Google Sheets</p><h2>Catalog synchronization</h2></div></div>
            <button className="primary-button" type="button" onClick={() => void syncSheets}>Import catalog from Sheets</button>
            <div className="inventory-list">
              {syncRuns.map((run) => <div className="inventory-row" key={run.id}><div><strong>{run.status}</strong><small>{run.started_at}</small></div><small>{run.product_count} products / {run.variant_count} variants</small>{run.error && <small>{run.error}</small>}</div>)}
            </div>
          </section>
        </>
      )}
      <section className="staff-section">
        <div className="staff-section-heading">
          <div><p className="eyebrow">New item</p><h2>Add product</h2></div>
        </div>
        <form className="staff-form" onSubmit={addProduct}>
          <label>Product ID<input required value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} placeholder="soft-cotton-set" /></label>
          <label>Name<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Soft cotton set" /></label>
          <label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as ProductDraft["category"] })}>{categories.filter((category) => category !== "All items").map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label>Price in KSh<input required min="0" type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label>
          <label>Description<textarea required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <label>Image URL<input required type="url" value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} /></label>
          <label>Image alt text<input required value={draft.imageAlt} onChange={(event) => setDraft({ ...draft, imageAlt: event.target.value })} /></label>
          <div className="staff-variant">
            <strong>First variant</strong>
            <label>Age range<input required value={draft.variants[0].label} onChange={(event) => setDraft({ ...draft, variants: [{ ...draft.variants[0], label: event.target.value }] })} placeholder="0-12 months" /></label>
            <label>Color<input required value={draft.variants[0].color} onChange={(event) => setDraft({ ...draft, variants: [{ ...draft.variants[0], color: event.target.value }] })} /></label>
            <label>Stock<input required min="0" type="number" value={draft.variants[0].stock} onChange={(event) => setDraft({ ...draft, variants: [{ ...draft.variants[0], stock: Number(event.target.value) }] })} /></label>
          </div>
          <button className="primary-button" disabled={source !== "supabase"} type="submit">Add product <span aria-hidden="true">&#8594;</span></button>
          {source !== "supabase" && <small>Connect Supabase before saving inventory.</small>}
        </form>
      </section>
    </>
  );

  const renderAuth = () => (
    <>
      <header className="staff-header">
        <div>
          <p className="eyebrow">ROMIBS Traders</p>
          <h1>Inventory desk</h1>
          <p>Private staff access for catalog and stock updates.</p>
        </div>
        <Link className="secondary-button" href="/">Return to shop</Link>
      </header>

      <section className="staff-auth-card">
        <p className="eyebrow">Staff access</p>
        <h2>Sign in</h2>
        <form className="staff-auth-form" onSubmit={handleAuthSubmit}>
          <label>Email<input type="email" required value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} placeholder="manager@romibs.com" /></label>
          <label>Password<input type="password" required minLength={6} value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} placeholder="••••••" /></label>
          <button className="primary-button" type="submit">Continue</button>
          <p>Staff accounts are provisioned by an administrator.</p>
        </form>
        {authMessage && <p className="staff-message">{authMessage}</p>}
      </section>
    </>
  );

  if (authLoading) {
    return <main className="staff-page"><header className="staff-header"><div><p className="eyebrow">ROMIBS Traders</p><h1>Inventory desk</h1></div></header><p className="staff-message">Loading staff access...</p></main>;
  }

  if (!browserSupabase) {
    return <main className="staff-page"><header className="staff-header"><div><p className="eyebrow">ROMIBS Traders</p><h1>Inventory desk</h1></div><Link className="secondary-button" href="/">Return to shop</Link></header><section className="staff-auth-card"><p className="eyebrow">Staff access</p><h2>Supabase not configured</h2><p className="staff-message">Configure Supabase in .env.local to enable staff sign-in.</p></section></main>;
  }

  if (!session) return <main className="staff-page">{renderAuth()}</main>;
  if (staffAccess.status === "checking") return <main className="staff-page"><p className="staff-message">Verifying staff access...</p></main>;
  if (staffAccess.status === "allowed") return <main className="staff-page">{renderInventory()}</main>;

  return <main className="staff-page"><section className="staff-auth-card"><p className="eyebrow">Staff access</p><h2>{staffAccess.status === "error" ? "Unable to verify access" : "No staff access"}</h2><p className="staff-message">{staffAccess.message ?? "This account is not authorized to use the inventory desk."}</p><div className="staff-header-actions"><button className="secondary-button" type="button" onClick={handleSignOut}>Sign out</button><Link className="secondary-button" href="/">Return to shop</Link></div></section></main>;
}

function InventoryRow({ product, onSave, onDelete }: Readonly<{ product: Product; onSave: (product: Product) => Promise<void>; onDelete: (product: Product) => Promise<void> }>) {
  const [draft, setDraft] = useState(product);

  return <form className="inventory-row" onSubmit={async (event) => { event.preventDefault(); await onSave(draft); }}>
    <div className="inventory-row-main">
      <div>
        <label>Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Product["category"] })}>{categories.filter((category) => category !== "All items").map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      </div>
    </div>
    <div className="inventory-row-values">
      <label>Price<input type="number" min="0" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label>
      <label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      <label>Image URL<input type="url" value={draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} /></label>
      <label>Image alt text<input value={draft.imageAlt} onChange={(event) => setDraft({ ...draft, imageAlt: event.target.value })} /></label>
      <label>Featured<input type="checkbox" checked={draft.featured ?? false} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} /></label>
      {draft.variants.map((variant, index) => (
        <fieldset key={variant.id}>
          <legend>Variant</legend>
          <label>Variant ID<input value={variant.id} onChange={(event) => setDraft({ ...draft, variants: draft.variants.map((currentVariant, currentIndex) => currentIndex === index ? { ...currentVariant, id: event.target.value } : currentVariant) })} /></label>
          <label>Age / size<input value={variant.label} onChange={(event) => setDraft({ ...draft, variants: draft.variants.map((currentVariant, currentIndex) => currentIndex === index ? { ...currentVariant, label: event.target.value } : currentVariant) })} /></label>
          <label>Color<input value={variant.color} onChange={(event) => setDraft({ ...draft, variants: draft.variants.map((currentVariant, currentIndex) => currentIndex === index ? { ...currentVariant, color: event.target.value } : currentVariant) })} /></label>
          <label>Stock<input type="number" min="0" value={variant.stock} onChange={(event) => setDraft({ ...draft, variants: draft.variants.map((currentVariant, currentIndex) => currentIndex === index ? { ...currentVariant, stock: Number(event.target.value) } : currentVariant) })} /></label>
          <button className="secondary-button" type="button" onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, currentIndex) => currentIndex !== index) })}>Remove variant</button>
        </fieldset>
      ))}
      <button className="secondary-button" type="button" onClick={() => setDraft({ ...draft, variants: [...draft.variants, { id: `${draft.id}-variant-${draft.variants.length + 1}`, label: "", color: "", stock: 0 }] })}>Add variant</button>
    </div>
    <div className="staff-header-actions">
      <button className="secondary-button" type="submit">Save</button>
      <button className="secondary-button" type="button" onClick={() => void onDelete(draft)}>Delete</button>
    </div>
  </form>;
}
