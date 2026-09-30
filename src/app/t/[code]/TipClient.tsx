"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { createClient } from "@/lib/supabase/client";
import { BRAND_LOWER } from "@/lib/brand";
import { feeFor, firstName, initials, money, moneyShort } from "@/lib/format";
import type { PublicTag } from "@/lib/types";
import StripePay from "./StripePay";

type Phase = "choose" | "confirm" | "stripe" | "done";

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = (pk: string) => (stripePromise ??= loadStripe(pk));

export default function TipClient({ tag, stripePk }: { tag: PublicTag; stripePk: string | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [amount, setAmount] = useState(tag.amount_cents);
  const [other, setOther] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [cover, setCover] = useState(true);
  const [phase, setPhase] = useState<Phase>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipId, setTipId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [rating, setRating] = useState(0);

  const name = firstName(tag.full_name);
  const fee = feeFor(amount, tag.fee_bps);
  const total = amount + (cover ? fee : 0);
  const net = cover ? amount : amount - fee;
  const valid = amount >= 1000 && amount <= 500000;
  const paymentsOff = !tag.demo_mode && !stripePk;

  const chips = [...new Set([tag.amount_cents, 2000, 5000, 10000])].sort((a, b) => a - b).slice(0, 4);

  function pickChip(c: number) {
    setOther(false);
    setAmount(c);
  }
  function onOther(v: string) {
    const clean = v.replace(/[^\d]/g, "").slice(0, 4);
    setOtherText(clean);
    setAmount(Number(clean || 0) * 100);
  }

  async function startPay() {
    setError(null);
    if (!valid) return setError("El monto debe ser entre $10 y $5,000.");
    if (tag.demo_mode) return setPhase("confirm");

    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: tag.code, amountCents: amount, cover }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo iniciar el pago.");
      setClientSecret(json.clientSecret);
      setTipId(json.tipId);
      setPhase("stripe");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDemo() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("demo_pay_tip", {
      p_code: tag.code,
      p_amount_cents: amount,
      p_cover: cover,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setTipId(data as string);
    setPhase("done");
  }

  async function rate(n: number) {
    setRating(n);
    if (tipId) await supabase.rpc("rate_tip", { p_tip_id: tipId, p_rating: n });
  }

  return (
    <main className="tip-page">
      <div className="tip-top">
        <span className="wordmark">{BRAND_LOWER}</span>
        <small>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          Pago seguro
        </small>
      </div>

      <section className="tip-sheet" aria-live="polite">
        {phase !== "done" && (
          <div className="who">
            <div className="avatar" aria-hidden>{initials(tag.full_name)}</div>
            <div>
              <strong>{tag.full_name}</strong>
              <span>{[tag.role_title, tag.place].filter(Boolean).join(" · ")}</span>
              <span className="verif">✓ Tarjeta registrada</span>
            </div>
          </div>
        )}

        {phase === "choose" && (
          <>
            <div className="amt-big">
              {valid || !other ? moneyShort(amount) : "$—"}
              <small>MXN</small>
            </div>
            <div className="chips">
              {chips.map((c) => (
                <button key={c} type="button" aria-pressed={!other && amount === c} onClick={() => pickChip(c)}>
                  {moneyShort(c)}
                </button>
              ))}
              <button type="button" aria-pressed={other} onClick={() => { setOther(true); onOther(otherText); }}>
                Otro
              </button>
            </div>
            {other && (
              <label className="other">
                <span>$</span>
                <input
                  id="other-amount"
                  inputMode="numeric"
                  autoFocus
                  placeholder="Monto"
                  value={otherText}
                  onChange={(e) => onOther(e.target.value)}
                  aria-label="Otro monto en pesos"
                />
              </label>
            )}
            <button type="button" className="switch" role="switch" aria-checked={cover} onClick={() => setCover(!cover)}>
              <span className="sw" />
              <span>
                Agregar {money(fee)} de comisión para que {name} reciba el 100%
              </span>
            </button>
            {error && <p className="err">{error}</p>}
            {paymentsOff ? (
              <p className="err">Los pagos no están disponibles en este momento.</p>
            ) : (
              <button type="button" className="btn btn-dark btn-block" disabled={!valid || busy} onClick={startPay}>
                {busy ? "Preparando…" : `Dejar propina de ${money(total)}`}
              </button>
            )}
            <p className="fine">
              {tag.demo_mode ? (
                <span className="badge-demo">Modo demo · no se hace ningún cobro</span>
              ) : (
                "Apple Pay, Google Pay o tarjeta"
              )}
            </p>
          </>
        )}

        {phase === "confirm" && (
          <>
            <div className="rows">
              <div><span>Propina para {name}</span><span>{money(amount)}</span></div>
              {cover && <div><span>Comisión de servicio</span><span>{money(fee)}</span></div>}
              <div><span>Total</span><span>{money(total)}</span></div>
            </div>
            <p className="fine"><span className="badge-demo">Modo demo · simula Apple Pay, no se cobra</span></p>
            {error && <p className="err">{error}</p>}
            <button type="button" className="btn btn-dark btn-block" disabled={busy} onClick={confirmDemo}>
              {busy ? "Procesando…" : "Confirmar pago"}
            </button>
            <button type="button" className="btn btn-line btn-block" disabled={busy} onClick={() => setPhase("choose")}>
              Cambiar monto
            </button>
          </>
        )}

        {phase === "stripe" && stripePk && clientSecret && (
          <Elements
            stripe={getStripe(stripePk)}
            options={{ clientSecret, locale: "es-419", appearance: { theme: "stripe", variables: { colorPrimary: "#0B7A55", borderRadius: "12px" } } }}
          >
            <StripePay
              totalLabel={money(total)}
              returnUrl={typeof window !== "undefined" ? window.location.href : ""}
              onPaid={() => setPhase("done")}
              onBack={() => setPhase("choose")}
            />
          </Elements>
        )}

        {phase === "done" && (
          <div className="done">
            <div className="check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </div>
            <h2>¡Propina enviada!</h2>
            <p>{name} recibió {money(net)}. ¡Gracias!</p>
            <div className="stars" role="group" aria-label={`¿Cómo te atendió ${name}?`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={n <= rating ? "on" : ""} aria-label={`${n} estrellas`} onClick={() => rate(n)}>
                  ★
                </button>
              ))}
            </div>
            <p className="fine">{rating ? "¡Gracias por calificar!" : `¿Cómo te atendió ${name}?`}</p>
          </div>
        )}
      </section>
    </main>
  );
}
