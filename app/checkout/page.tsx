"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/catalog";

type StoredLine = { product: { id: string; name: string; price: number; image: string }; variant: { id: string; label: string; color: string }; quantity: number };
type Delivery = "nairobi" | "nationwide";

const deliveryRates: Record<Delivery, number> = { nairobi: 250, nationwide: 600 };

export default function CheckoutPage() {
  const [cart, setCart] = useState<StoredLine[]>([]);
  const [delivery, setDelivery] = useState<Delivery>("nairobi");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("romibs-cart");
    if (saved) setCart(JSON.parse(saved) as StoredLine[]);
  }, []);

  const subtotal = useMemo(() => cart.reduce((total, line) => total + line.product.price * line.quantity, 0), [cart]);
  const total = subtotal + (cart.length ? deliveryRates[delivery] : 0);

  if (submitted) {
    return <main className="checkout-page"><div className="checkout-success"><span className="success-mark">R</span><p className="eyebrow">Order request received</p><h1>We have your details.</h1><p>We will confirm availability and send your secure payment link shortly. Thank you for choosing ROMIBS.</p><Link className="primary-button" href="/">Return to shop <span aria-hidden="true">&#8594;</span></Link></div></main>;
  }

  return <main className="checkout-page"><header className="checkout-header"><Link className="brand" href="/"><span className="brand-mark">R</span><span><strong>ROMIBS</strong><small>TRADERS</small></span></Link><Link className="back-link" href="/">Back to shop</Link></header><div className="checkout-layout"><section><p className="eyebrow">Almost yours</p><h1>Complete your order</h1><form className="checkout-form" onSubmit={(event) => { event.preventDefault(); if (cart.length) setSubmitted(true); }}><fieldset><legend>Contact</legend><label>Full name<input required name="name" placeholder="Your name" /></label><label>Phone number<input required name="phone" type="tel" placeholder="07XX XXX XXX" /></label><label>Email address<input required name="email" type="email" placeholder="you@example.com" /></label></fieldset><fieldset><legend>Delivery</legend><div className="delivery-options"><label className={delivery === "nairobi" ? "delivery-option selected" : "delivery-option"}><input checked={delivery === "nairobi"} name="delivery" onChange={() => setDelivery("nairobi")} type="radio" /><span><strong>Nairobi delivery</strong><small>Same or next day / KSh 250</small></span></label><label className={delivery === "nationwide" ? "delivery-option selected" : "delivery-option"}><input checked={delivery === "nationwide"} name="delivery" onChange={() => setDelivery("nationwide")} type="radio" /><span><strong>Nationwide delivery</strong><small>2 - 4 working days / KSh 600</small></span></label></div><label>Delivery address<textarea required name="address" placeholder="Estate, building, street, town" rows={3} /></label></fieldset><button className="primary-button checkout-submit" disabled={!cart.length} type="submit">Request secure payment <span aria-hidden="true">&#8594;</span></button><p className="checkout-note">You will be redirected to a secure M-Pesa or card payment link after we confirm your order.</p></form></section><aside className="order-summary"><p className="eyebrow">Your selection</p><h2>Order summary</h2>{cart.length ? <div className="summary-lines">{cart.map((line) => <div className="summary-line" key={line.variant.id}><div className="summary-thumb" style={{ backgroundImage: `url(${line.product.image})` }} /><div><strong>{line.product.name}</strong><span>{line.variant.label} / {line.variant.color} x {line.quantity}</span></div><b>{formatPrice(line.product.price * line.quantity)}</b></div>)}</div> : <p className="empty-summary">Your bag is empty. <Link href="/">Browse the collection</Link></p>}<div className="summary-total"><div><span>Subtotal</span><b>{formatPrice(subtotal)}</b></div><div><span>Delivery</span><b>{formatPrice(cart.length ? deliveryRates[delivery] : 0)}</b></div><div className="total-row"><span>Total</span><b>{formatPrice(total)}</b></div></div></aside></div></main>;
}
