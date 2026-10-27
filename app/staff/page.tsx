"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { categories, formatPrice, type Category, type Product } from "@/lib/catalog";
import { browserSupabase } from "@/lib/supabase";

type ProductDraft = { id: string; name: string; category: Exclude<Category, "All items">; price: number; description: string; image: string; imageAlt: string; variants: Product["variants"] };
const emptyDraft: ProductDraft = { id: "", name: "", category: "Everyday wear", price: 0, description: "", image: "", imageAlt: "", variants: [{ id: "", label: "", color: "", stock: 0 }] };

export default function StaffPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [source, setSource] = useState("loading");
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
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

  const loadProducts = async () => {
    const response = await fetch("/api/catalog");
    const data = await response.json() as { products?: Product[]; source?: string; error?: string };
    setProducts(data.products ?? []);
    setSource(data.source ?? "demo");
    if (data.error) setMessage(data.error);
  };

  useEffect(() => {
    if (!session) {
      setProducts([]);
      setSource("demo");
      return;
    }

    void loadProducts();
  }, [session]);

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
        body: JSON.stringify({ id: product.id, price: product.price, variants: product.variants }),
      });
      const data = await response.json() as { error?: string };
      setMessage(response.ok ? `${product.name} updated.` : data.error ?? "Update failed.");
      if (response.ok) await loadProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
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
      const request = authMode === "sign-in"
        ? browserSupabase.auth.signInWithPassword({ email: credentials.email, password: credentials.password })
        : browserSupabase.auth.signUp({ email: credentials.email, password: credentials.password });

      const { error } = await request;
      if (error) throw error;

      setAuthMessage(authMode === "sign-in" ? "Signed in successfully." : "Check your email to confirm sign up.");
      if (authMode === "sign-in") setCredentials({ email: "", password: "" });
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
        <div className="inventory-list">{products.map((product) => <InventoryRow key={product.id} product={product} onSave={updateProduct} />)}</div>
      </section>
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
        <h2>{authMode === "sign-in" ? "Sign in" : "Create staff account"}</h2>
        <form className="staff-auth-form" onSubmit={handleAuthSubmit}>
          <label>Email<input type="email" required value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} placeholder="manager@romibs.com" /></label>
          <label>Password<input type="password" required minLength={6} value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} placeholder="••••••" /></label>
          <button className="primary-button" type="submit">{authMode === "sign-in" ? "Continue" : "Create account"}</button>
          <button className="text-button" type="button" onClick={() => setAuthMode((currentMode) => currentMode === "sign-in" ? "sign-up" : "sign-in")}>{authMode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}</button>
        </form>
        {authMessage && <p className="staff-message">{authMessage}</p>}
      </section>
    </>
  );

  if (authLoading) {
    return <main className="staff-page"><header className="staff-header"><div><p className="eyebrow">ROMIBS Traders</p><h1>Inventory desk</h1></div></header><p className="staff-message">Loading staff access...</p></main>;
  }

  return <main className="staff-page">{!browserSupabase ? <><header className="staff-header"><div><p className="eyebrow">ROMIBS Traders</p><h1>Inventory desk</h1></div><Link className="secondary-button" href="/">Return to shop</Link></header><section className="staff-auth-card"><p className="eyebrow">Staff access</p><h2>Supabase not configured</h2><p className="staff-message">Configure Supabase in .env.local to enable staff sign-in.</p></section></> : session ? renderInventory() : renderAuth()}</main>;
}

function InventoryRow({ product, onSave }: Readonly<{ product: Product; onSave: (product: Product) => Promise<void> }>) {
  const [draft, setDraft] = useState(product);

  return <form className="inventory-row" onSubmit={async (event) => { event.preventDefault(); await onSave(draft); }}>
    <div className="inventory-row-main">
      <div>
        <strong>{product.name}</strong>
        <small>{product.category}</small>
      </div>
      <div className="inventory-row-values">
        <label>Price<input type="number" min="0" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label>
        <label>Stock<input type="number" min="0" value={draft.variants[0]?.stock ?? 0} onChange={(event) => setDraft({ ...draft, variants: [{ ...draft.variants[0], stock: Number(event.target.value) }] })} /></label>
      </div>
    </div>
    <button className="secondary-button" type="submit">Save</button>
  </form>;
}
