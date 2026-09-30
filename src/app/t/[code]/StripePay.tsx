"use client";

import { useState } from "react";
import { ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

// Apple Pay / Google Pay (botón exprés) + tarjeta como respaldo.
export default function StripePay({
  totalLabel,
  returnUrl,
  onPaid,
  onBack,
}: {
  totalLabel: string;
  returnUrl: string;
  onPaid: () => void;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });
    setBusy(false);
    if (error) return setError(error.message ?? "No se pudo completar el pago.");
    if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") onPaid();
  }

  async function submitCard(e: React.FormEvent) {
    e.preventDefault();
    if (!elements) return;
    const { error } = await elements.submit();
    if (error) return setError(error.message ?? "Revisa los datos de la tarjeta.");
    await confirm();
  }

  return (
    <form onSubmit={submitCard} style={{ display: "grid", gap: 14 }}>
      <ExpressCheckoutElement
        onConfirm={confirm}
        options={{ buttonType: { applePay: "plain", googlePay: "plain" }, buttonHeight: 50 }}
      />
      <p className="fine">o con tarjeta</p>
      <PaymentElement options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never" } }} />
      {error && <p className="err">{error}</p>}
      <button type="submit" className="btn btn-dark btn-block" disabled={!stripe || busy}>
        {busy ? "Procesando…" : `Pagar ${totalLabel}`}
      </button>
      <button type="button" className="btn btn-line btn-block" disabled={busy} onClick={onBack}>
        Cambiar monto
      </button>
    </form>
  );
}
