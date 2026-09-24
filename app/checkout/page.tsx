"use client";

import { type SubmitEvent, useEffect, useMemo, useState } from "react";
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

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!cart.length) return;

    const formData = new FormData(event.currentTarget);
    const getFormValue = (field: string) => {
      const value = formData.get(field);
      return typeof value === "string" ? value.trim() : "";
    };
    const name = getFormValue("name");
    const phone = getFormValue("phone");
    const email = getFormValue("email");
    const address = getFormValue("address");
    const deliveryLabel = delivery === "nairobi" ? "Nairobi delivery" : "Nationwide delivery";

    const orderLines = cart
      .map((line) => `- ${line.product.name} (${line.variant.label} / ${line.variant.color}) x${line.quantity} = ${formatPrice(line.product.price * line.quantity)}`)
      .join("\n");

    const subject = encodeURIComponent(`ROMIBS order request from ${name}`);
    const body = encodeURIComponent(
      `Hello ROMIBS Traders,\n\nPlease confirm this order request.\n\nCustomer: ${name}\nPhone: ${phone}\nEmail: ${email}\nDelivery option: ${deliveryLabel}\nAddress: ${address}\n\nItems:\n${orderLines}\n\nSubtotal: ${formatPrice(subtotal)}\nDelivery: ${formatPrice(deliveryRates[delivery])}\nTotal: ${formatPrice(total)}\n\nThank you.`,
    );

    window.location.href = `mailto:romibstraders@gmail.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="checkout-page">
        <div className="checkout-success">
          <span className="success-mark">R</span>
          <p className="eyebrow">Order email prepared</p>
          <h1>Your request is ready.</h1>
          <p>
            Your order request has been prepared for romibstraders@gmail.com. Send it from your email app,
            and ROMIBS will confirm availability, payment instructions, and delivery details.
          </p>
          <Link className="primary-button" href="/">
            Return to shop <span aria-hidden="true">&#8594;</span>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <header className="checkout-header">
        <Link className="brand" href="/">
          <span className="brand-mark">R</span>
          <span><strong>ROMIBS</strong><small>TRADERS</small></span>
        </Link>
        <Link className="back-link" href="/">Back to shop</Link>
      </header>

      <div className="checkout-layout">
        <section>
          <p className="eyebrow">Almost yours</p>
          <h1>Complete your order</h1>

          <form className="checkout-form" onSubmit={handleSubmit}>
            <fieldset>
              <legend>Contact</legend>
              <label>
                <span>Full name</span>
                <input autoComplete="name" required name="name" placeholder="Your name" />
              </label>
              <label>
                <span>Phone number</span>
                <input autoComplete="tel" inputMode="tel" required name="phone" type="tel" placeholder="07XX XXX XXX" />
              </label>
              <label>
                <span>Email address</span>
                <input autoComplete="email" required name="email" type="email" placeholder="you@example.com" />
              </label>
            </fieldset>

            <fieldset>
              <legend>Delivery</legend>
              <div className="delivery-options">
                <label aria-label="Nairobi delivery" className={delivery === "nairobi" ? "delivery-option selected" : "delivery-option"}>
                  <input checked={delivery === "nairobi"} name="delivery" onChange={() => setDelivery("nairobi")} type="radio" />
                  <span>
                    <strong>Nairobi delivery</strong>
                    <small>Same or next day / KSh 250</small>
                  </span>
                </label>

                <label aria-label="Nationwide delivery" className={delivery === "nationwide" ? "delivery-option selected" : "delivery-option"}>
                  <input checked={delivery === "nationwide"} name="delivery" onChange={() => setDelivery("nationwide")} type="radio" />
                  <span>
                    <strong>Nationwide delivery</strong>
                    <small>2 - 4 working days / KSh 600</small>
                  </span>
                </label>
              </div>

              <label>
                <span>Delivery address</span>
                <textarea autoComplete="street-address" required name="address" placeholder="Estate, building, street, town" rows={3} />
              </label>
            </fieldset>

            <button className="primary-button checkout-submit" disabled={!cart.length} type="submit">
              Prepare order email <span aria-hidden="true">&#8594;</span>
            </button>

            <p className="checkout-note">
              This prepares an email request. No payment is taken here; ROMIBS will confirm availability and share payment instructions.
            </p>
          </form>
        </section>

        <aside className="order-summary">
          <p className="eyebrow">Your cart</p>
          <div className="summary-lines">
            {cart.length ? (
              cart.map((line) => (
                <div className="summary-line" key={line.variant.id}>
                  <div className="summary-thumb" style={{ backgroundImage: `url(${line.product.image})` }} />
                  <div>
                    <strong>{line.product.name}</strong>
                    <span>{line.variant.label} / {line.variant.color}</span>
                    <small>{line.quantity} item{line.quantity > 1 ? "s" : ""}</small>
                  </div>
                  <strong>{formatPrice(line.product.price * line.quantity)}</strong>
                </div>
              ))
            ) : (
              <p className="empty-summary">Your bag is empty.</p>
            )}
          </div>

          <div className="summary-total"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
          <div className="summary-total"><span>Delivery</span><strong>{formatPrice(deliveryRates[delivery])}</strong></div>
          <div className="summary-total grand-total"><span>Total</span><strong>{formatPrice(total)}</strong></div>
        </aside>
      </div>
    </main>
  );
}
