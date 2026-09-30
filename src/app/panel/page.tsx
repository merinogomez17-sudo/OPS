import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { tagUrl } from "@/lib/format";
import type { Tag, Tip, Withdrawal, Worker } from "@/lib/types";
import Panel from "./Panel";

export const metadata: Metadata = { title: "Mis propinas" };

export default async function PanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const [{ data: worker }, { data: tags }, { data: tips }, { data: withdrawals }, { data: cfg }] = await Promise.all([
    supabase.from("workers").select("*").eq("id", user.id).single<Worker>(),
    supabase.from("tags").select("code,label,active,created_at").order("created_at"),
    supabase.from("tips").select("id,tag_code,amount_cents,fee_cents,fee_covered,net_cents,status,method,rating,created_at").eq("status", "paid").order("created_at", { ascending: false }).limit(50),
    supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("app_config").select("demo_mode").single<{ demo_mode: boolean }>(),
  ]);
  if (!worker) redirect("/entrar");

  const tagsWithQr = await Promise.all(
    ((tags as Tag[]) ?? []).map(async (t) => ({
      ...t,
      url: tagUrl(t.code),
      qrSvg: await QRCode.toString(tagUrl(t.code), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1a0a12", light: "#ffffff" } }),
    })),
  );

  return (
    <Panel
      initialWorker={worker}
      tags={tagsWithQr}
      initialTips={(tips as Tip[]) ?? []}
      initialWithdrawals={(withdrawals as Withdrawal[]) ?? []}
      demoMode={cfg?.demo_mode ?? true}
    />
  );
}
