import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { BRAND_LOWER } from "@/lib/brand";
import type { PublicTag } from "@/lib/types";
import TipClient from "./TipClient";

async function getTag(code: string): Promise<PublicTag | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_tag_public", { p_code: code });
  return (data as PublicTag[] | null)?.[0] ?? null;
}

export async function generateMetadata({ params }: PageProps<"/t/[code]">): Promise<Metadata> {
  const { code } = await params;
  const tag = await getTag(code);
  return { title: tag ? `Propina para ${tag.full_name}` : "Tarjeta no encontrada" };
}

export default async function TipPage({ params }: PageProps<"/t/[code]">) {
  const { code } = await params;
  const tag = await getTag(code);

  if (!tag) {
    return (
      <main className="tip-page">
        <div className="notfound">
          <p className="wordmark" style={{ fontSize: 24 }}>{BRAND_LOWER}</p>
          <h1 style={{ fontSize: 26, margin: "12px 0 8px" }}>Esta tarjeta no está activa</h1>
          <p style={{ opacity: 0.8, margin: 0 }}>Puede que la hayan desactivado. Pídele al trabajador su QR o su link.</p>
        </div>
      </main>
    );
  }

  const stripeReady = Boolean(
    !tag.demo_mode && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY && process.env.STRIPE_SECRET_KEY,
  );

  return (
    <TipClient
      tag={tag}
      stripePk={stripeReady ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY! : null}
    />
  );
}
