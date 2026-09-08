"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { categories, formatPrice, getAvailableStock, products, type Category, type Product, type Variant } from "@/lib/catalog";

type CartLine = {
  product: Product;
  variant: Variant;
  quantity: number;
};

const lowStockThreshold = 3;

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category>("All items");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const savedCart = window.localStorage.getItem("romibs-cart");
    if (savedCart) setCart(JSON.parse(savedCart) as CartLine[]);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("romibs-cart", JSON.stringify(cart));
  }, [cart]);

  const visibleProducts = useMemo(
    () => activeCategory === "All items" ? products : products.filter((product) => product.category === activeCategory),
    [activeCategory],
  );

  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);
  const subtotal = cart.reduce((total, line) => total + line.product.price * line.quantity, 0);

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedVariant(product.variants.find((variant) => variant.stock > 0) ?? product.variants[0]);
  };

  const addToCart = (product: Product, variant: Variant) => {
    if (variant.stock < 1) return;
    setCart((currentCart) => {
      const existingLine = currentCart.some((line) => line.variant.id === variant.id);
      if (existingLine) {
        return currentCart.map((line) => line.variant.id === variant.id
          ? { ...line, quantity: Math.min(line.quantity + 1, variant.stock) }
          : line);
      }
      return [...currentCart, { product, variant, quantity: 1 }];
    });
    setSelectedProduct(null);
    setCartOpen(true);
    setNotice(`${product.name} added to your bag`);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const updateQuantity = (variantId: string, nextQuantity: number) => {
    setCart((currentCart) => currentCart
      .map((line) => line.variant.id === variantId
        ? { ...line, quantity: Math.min(Math.max(nextQuantity, 0), line.variant.stock) }
        : line)
      .filter((line) => line.quantity > 0));
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="ROMIBS Traders home">
          <span className="brand-mark">R</span>
          <span><strong>ROMIBS</strong><small>TRADERS</small></span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#shop">Shop</a>
          <a href="#story">Our approach</a>
          <a href="#contact">Contact</a>
        </nav>
        <button className="bag-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Open shopping bag, ${cartCount} items`}>
          Bag <span>{cartCount.toString().padStart(2, "0")}</span>
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Nairobi / East Africa</p>
          <h1>Little pieces.<br /><em>Big days.</em></h1>
          <p className="hero-intro">Thoughtful everyday essentials for little ones aged 10 and under. Made for play, comfort, and growing up.</p>
          <a className="primary-button" href="#shop">Explore the collection <span aria-hidden="true">&#8595;</span></a>
        </div>
        <div className="hero-image" role="img" aria-label="A person in a blue shirt standing in warm sunlight">
          <div className="hero-image-note"><span>01</span><span>For ages 10 and under</span></div>
        </div>
        <div className="hero-stamp" aria-hidden="true"><span>Made for</span><strong>REAL<br />LIFE</strong><span>Since 2014</span></div>
      </section>

      <section className="shop-section" id="shop">
        <div className="section-heading">
          <div><p className="eyebrow">The current edit</p><h2>Made for growing days</h2></div>
          <p className="section-note">Small batches, soft materials,<br />and room to move.</p>
        </div>
        <div className="filter-row" role="tablist" aria-label="Filter products by category">
          {categories.map((category) => <button key={category} className={activeCategory === category ? "filter active" : "filter"} type="button" onClick={() => setActiveCategory(category)}>{category}</button>)}
        </div>
        <div className="product-grid">
          {visibleProducts.map((product, index) => <ProductCard key={product.id} product={product} index={index} onOpen={openProduct} />)}
        </div>
      </section>

      <section className="story-section" id="story">
        <p className="eyebrow">Why ROMIBS</p>
        <div className="story-grid"><h2>Less fuss.<br /><em>More play.</em></h2><p>ROMIBS makes reliable, comfortable pieces for babies and children aged 10 and under. We are starting small, with more age ranges and everyday essentials to come.</p></div>
        <div className="values-row"><div><strong>01</strong><span>Made in small runs</span></div><div><strong>02</strong><span>Soft on growing skin</span></div><div><strong>03</strong><span>Room to move and play</span></div></div>
      </section>

      <footer id="contact"><div className="footer-brand"><span className="brand-mark">R</span><strong>ROMIBS TRADERS</strong></div><p>Little essentials for everyday Kenya.</p><div className="footer-links"><a href="mailto:romibstraders@gmail.com">romibstraders@gmail.com</a><span>Nairobi, Kenya</span></div></footer>

      {selectedProduct && <ProductModal product={selectedProduct} selectedVariant={selectedVariant} onSelectVariant={setSelectedVariant} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />}
      {cartOpen && <CartDrawer cart={cart} subtotal={subtotal} onClose={() => setCartOpen(false)} onUpdate={updateQuantity} />}
      {notice && <output className="toast">{notice}</output>}
    </main>
  );
}

function ProductCard({ product, index, onOpen }: Readonly<{ product: Product; index: number; onOpen: (product: Product) => void }>) {
  const stock = getAvailableStock(product);
  const stockClass = stock === 0 ? "stock-tag sold-out" : stock <= lowStockThreshold ? "stock-tag low-stock" : "stock-tag";
  const stockLabel = stock === 0 ? "Sold out" : stock <= lowStockThreshold ? "Low stock" : "In stock";
  return <article className="product-card" style={{ "--delay": `${index * 90}ms` } as React.CSSProperties}>
    <button className="product-image" type="button" onClick={() => onOpen(product)} style={{ backgroundImage: `url(${product.image})` }} aria-label={`View ${product.name}`}>
      {product.featured && <span className="featured-tag">Featured</span>}
      <span className={stockClass}>{stockLabel}</span>
      <span className="view-arrow" aria-hidden="true">&#8599;</span>
    </button>
    <div className="product-info"><div><p className="product-category">{product.category}</p><h3>{product.name}</h3></div><strong>{formatPrice(product.price)}</strong></div>
    <p className="product-description">{product.description}</p>
  </article>;
}

function ProductModal({ product, selectedVariant, onSelectVariant, onClose, onAdd }: Readonly<{ product: Product; selectedVariant: Variant | null; onSelectVariant: (variant: Variant) => void; onClose: () => void; onAdd: (product: Product, variant: Variant) => void }>) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="quick-view-title"><button className="close-button" type="button" onClick={onClose} aria-label="Close product view">x</button><div className="modal-image" style={{ backgroundImage: `url(${product.image})` }} /><div className="modal-details"><p className="product-category">{product.category}</p><h2 id="quick-view-title">{product.name}</h2><strong className="modal-price">{formatPrice(product.price)}</strong><p>{product.description}</p><div className="variant-field"><span>Choose age range</span><div className="variant-options">{product.variants.map((variant) => <button key={variant.id} className={selectedVariant?.id === variant.id ? "variant selected" : "variant"} disabled={variant.stock === 0} type="button" onClick={() => onSelectVariant(variant)}>{variant.label}<small>{variant.stock === 0 ? "Out" : `${variant.stock} left`}</small></button>)}</div></div><button className="primary-button full-width" disabled={!selectedVariant || selectedVariant.stock === 0} type="button" onClick={() => selectedVariant && onAdd(product, selectedVariant)}>Add to bag <span aria-hidden="true">&#8594;</span></button><p className="modal-note">Free Nairobi delivery over KSh 8,000</p></div></section></div>;
}

function CartDrawer({ cart, subtotal, onClose, onUpdate }: Readonly<{ cart: CartLine[]; subtotal: number; onClose: () => void; onUpdate: (variantId: string, quantity: number) => void }>) {
  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className="cart-drawer" aria-label="Shopping bag"><div className="drawer-header"><div><p className="eyebrow">Your selection</p><h2>Shopping bag</h2></div><button className="close-button" type="button" onClick={onClose} aria-label="Close shopping bag">x</button></div>{cart.length === 0 ? <div className="empty-bag"><span className="empty-icon">+</span><p>Your bag is waiting.</p><button className="text-button" type="button" onClick={onClose}>Continue browsing <span>&#8594;</span></button></div> : <><div className="cart-lines">{cart.map((line) => <div className="cart-line" key={line.variant.id}><div className="cart-thumb" style={{ backgroundImage: `url(${line.product.image})` }} /><div className="cart-line-detail"><strong>{line.product.name}</strong><span>{line.variant.label} / {line.variant.color}</span><div className="quantity"><button type="button" onClick={() => onUpdate(line.variant.id, line.quantity - 1)} aria-label={`Decrease ${line.product.name}`}>-</button><span>{line.quantity}</span><button type="button" onClick={() => onUpdate(line.variant.id, line.quantity + 1)} aria-label={`Increase ${line.product.name}`}>+</button></div></div><strong>{formatPrice(line.product.price * line.quantity)}</strong></div>)}</div><div className="cart-summary"><div><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div><p>Delivery calculated at checkout.</p><Link className="primary-button full-width" href="/checkout" onClick={onClose}>Checkout <span aria-hidden="true">&#8594;</span></Link></div></>}</aside></div>;
}
