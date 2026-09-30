import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { feeFor, firstName } from "@/lib/format";
import type { PublicTag } from "@/lib/types";

// Crea el cobro en Stripe y registra la propina como "pendiente".
// El webhook la marca como pagada y suma el saldo del trabajador.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const admin = createAdminClient();
  if (!secret || !admin) {
    return Response.json({ error: "Los pagos con tarjeta aún no están configurados." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.toUpperCase() : "";
  const amountCents = Number(body?.amountCents);
  const cover = body?.cover === true;
  if (!code || !Number.isInteger(amountCents) || amountCents < 1000 || amountCents > 500000) {
    return Response.json({ error: "Monto no válido." }, { status: 400 });
  }

  const { data: tags } = await admin.rpc("get_tag_public", { p_code: code });
  const tag = (tags as PublicTag[] | null)?.[0];
  if (!tag) return Response.json({ error: "Tarjeta no encontrada." }, { status: 404 });

  const { data: owner } = await admin
    .from("tags")
    .select("workers(stripe_account_id)")
    .eq("code", code)
    .single<{ workers: { stripe_account_id: string | null } | null }>();
  const destination = owner?.workers?.stripe_account_id ?? null;

  const fee = feeFor(amountCents, tag.fee_bps);
  const total = amountCents + (cover ? fee : 0);

  const stripe = new Stripe(secret);
  const intent = await stripe.paymentIntents.create({
    amount: total,
    currency: "mxn",
    automatic_payment_methods: { enabled: true },
    description: `Propina para ${firstName(tag.full_name)}`,
    metadata: { tag_code: code, amount_cents: String(amountCents), fee_covered: String(cover) },
    // Cuando el trabajador ya conectó su cuenta de Stripe, el dinero va directo a él
    // y la plataforma se queda con la comisión.
    ...(destination ? { transfer_data: { destination }, application_fee_amount: fee } : {}),
  });

  const { data: tipId, error } = await admin.rpc("create_pending_tip", {
    p_code: code,
    p_amount_cents: amountCents,
    p_cover: cover,
    p_pi: intent.id,
  });
  if (error) return Response.json({ error: "No se pudo registrar la propina." }, { status: 500 });

  return Response.json({ clientSecret: intent.client_secret, tipId });
}
