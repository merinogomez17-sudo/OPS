import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe avisa aquí cuando un pago se completa o falla.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = createAdminClient();
  if (!secret || !whSecret || !admin) return new Response("No configurado", { status: 503 });

  const stripe = new Stripe(secret);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", whSecret);
  } catch {
    return new Response("Firma inválida", { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    const method = pi.payment_method_types?.[0] ?? "stripe";
    await admin.rpc("mark_tip_paid", { p_pi: pi.id, p_method: method });
  } else if (event.type === "payment_intent.payment_failed") {
    await admin.from("tips").update({ status: "failed" }).eq("stripe_payment_intent_id", event.data.object.id).eq("status", "pending");
  }

  return Response.json({ received: true });
}
