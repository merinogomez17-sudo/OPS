"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND_LOWER } from "@/lib/brand";
import { firstName, money, moneyShort } from "@/lib/format";
import type { Tag, Tip, Withdrawal, Worker } from "@/lib/types";

type TagView = Tag & { url: string; qrSvg: string };

const PRESETS = [2000, 3000, 4000, 5000, 10000];
const WITHDRAW = [
  { id: "spei", title: "Cuenta bancaria (SPEI)", sub: "Llega el mismo día", fee: 0 },
  { id: "instant", title: "Retiro inmediato", sub: "En menos de 1 minuto", fee: 900 },
  { id: "mercadopago", title: "Mercado Pago", sub: "Si no tienes cuenta de banco", fee: 0 },
  { id: "oxxo", title: "Efectivo en OXXO", sub: "Con código de retiro", fee: 1200 },
] as const;
const WITHDRAW_LABEL: Record<string, string> = { spei: "cuenta bancaria", instant: "retiro inmediato", mercadopago: "Mercado Pago", oxxo: "OXXO" };

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === y.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
};

export default function Panel({
  initialWorker,
  tags,
  initialTips,
  initialWithdrawals,
  demoMode,
}: {
  initialWorker: Worker;
  tags: TagView[];
  initialTips: Tip[];
  initialWithdrawals: Withdrawal[];
  demoMode: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [worker, setWorker] = useState(initialWorker);
  const [tips, setTips] = useState(initialTips);
  const [withdrawals, setWithdrawals] = useState(initialWithdrawals);
  const [fresh, setFresh] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; sub: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const seen = useRef(new Set(initialTips.map((t) => t.id)));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(title: string, sub: string) {
    setToast({ title, sub });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  // Avisos en tiempo real: propinas nuevas y cambios de saldo
  useEffect(() => {
    const channel = supabase
      .channel(`worker-${worker.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tips", filter: `worker_id=eq.${worker.id}` }, (payload) => {
        const t = payload.new as Tip;
        if (!t?.id || t.status !== "paid" || seen.current.has(t.id)) return;
        seen.current.add(t.id);
        setTips((prev) => [t, ...prev.filter((p) => p.id !== t.id)]);
        setFresh(t.id);
        showToast(`Recibiste ${money(t.net_cents)}`, "Propina nueva");
        try { navigator.vibrate?.([80, 60, 80]); } catch {}
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tips", filter: `worker_id=eq.${worker.id}` }, (payload) => {
        const t = payload.new as Tip;
        setTips((prev) => prev.map((p) => (p.id === t.id ? { ...p, rating: t.rating } : p)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "workers", filter: `id=eq.${worker.id}` }, (payload) => {
        const w = payload.new as Worker;
        setWorker((prev) => ({ ...prev, balance_cents: w.balance_cents }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, worker.id]);

  function setAmount(cents: number) {
    const v = Math.max(1000, Math.min(500000, cents));
    setWorker((w) => ({ ...w, amount_cents: v }));
    setSaved(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("workers").update({ amount_cents: v }).eq("id", worker.id);
      setSaved(error ? "No se pudo guardar. Intenta de nuevo." : `Listo: tu tarjeta ya cobra ${moneyShort(v)}.`);
    }, 450);
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const patch = {
      full_name: String(f.get("full_name") || "").trim(),
      role_title: String(f.get("role_title") || "").trim(),
      place: String(f.get("place") || "").trim(),
    };
    const { error } = await supabase.from("workers").update(patch).eq("id", worker.id);
    if (error) return showToast("No se pudo guardar", error.message);
    setWorker((w) => ({ ...w, ...patch }));
    showToast("Perfil actualizado", "Así te verán tus clientes");
  }

  async function withdraw(method: string) {
    setErr(null);
    const { data, error } = await supabase.rpc("request_withdrawal", { p_method: method });
    if (error) return setErr(error.message);
    const w = data as Withdrawal;
    setWithdrawals((prev) => [w, ...prev]);
    setWorker((prev) => ({ ...prev, balance_cents: 0 }));
    setSheet(false);
    showToast("Retiro solicitado", `${money(w.amount_cents)} a ${WITHDRAW_LABEL[w.method]}`);
  }

  async function addTag() {
    const { error } = await supabase.rpc("create_my_tag", { p_label: `Tarjeta ${tags.length + 1}` });
    if (error) return showToast("No se pudo crear", error.message);
    router.refresh();
  }

  async function toggleTag(t: TagView) {
    const { error } = await supabase.from("tags").update({ active: !t.active }).eq("code", t.code);
    if (error) return showToast("No se pudo cambiar", error.message);
    router.refresh();
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("Copia tu link:", url);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/entrar");
    router.refresh();
  }

  const moves = [
    ...tips.map((t) => ({ kind: "tip" as const, id: t.id, at: t.created_at, cents: t.net_cents, t })),
    ...withdrawals.map((w) => ({ kind: "wd" as const, id: w.id, at: w.created_at, cents: -w.amount_cents, w })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const todayTotal = tips.filter((t) => dayLabel(t.created_at) === "Hoy").reduce((s, t) => s + t.net_cents, 0);
  const name = firstName(worker.full_name) || "de nuevo";

  return (
    <main className="panel">
      {toast && (
        <div className="toast" role="status">
          <span className="app">t</span>
          <div><strong>{toast.title}</strong><span>{toast.sub}</span></div>
        </div>
      )}

      <header className="p-head">
        <div className="row1">
          <small>{[worker.role_title, worker.place].filter(Boolean).join(" · ") || BRAND_LOWER}</small>
          <button className="out" type="button" onClick={signOut}>Salir</button>
        </div>
        <h1>Hola, {name}</h1>
        <div className="bal">
          <div>
            <div className="k">Saldo disponible</div>
            <div className="v">{money(worker.balance_cents)}</div>
            <div className="k">Hoy: {money(todayTotal)}</div>
          </div>
          <button type="button" onClick={() => setSheet(true)} disabled={worker.balance_cents <= 0}>Retirar</button>
        </div>
      </header>

      <div className="p-body">
        {demoMode && (
          <p className="badge-demo" style={{ justifySelf: "start" }}>Modo demo: las propinas son simuladas y no hay cobros reales</p>
        )}

        <section className="sec">
          <h2>Monto de mi tarjeta</h2>
          <div className="box">
            <div className="amtset">
              <span className="v">{moneyShort(worker.amount_cents)}</span>
              <span className="stepper">
                <button type="button" aria-label="Bajar $5" onClick={() => setAmount(worker.amount_cents - 500)}>−</button>
                <button type="button" aria-label="Subir $5" onClick={() => setAmount(worker.amount_cents + 500)}>+</button>
              </span>
            </div>
            <div className="wchips">
              {PRESETS.map((p) => (
                <button key={p} type="button" aria-pressed={worker.amount_cents === p} onClick={() => setAmount(p)}>{moneyShort(p)}</button>
              ))}
            </div>
            <p className="note">{saved ?? "Es el monto que verá el cliente al acercar su celular. Puede elegir otro si quiere."}</p>
          </div>
        </section>

        <section className="sec">
          <h2>Mis tarjetas</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {tags.map((t) => (
              <div className="box tagbox" key={t.code} style={t.active ? undefined : { opacity: 0.6 }}>
                <div className="ncard">
                  <span className="wordmark">{BRAND_LOWER}</span>
                  <svg className="nfc" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M6 8.5a6 6 0 0 1 0 7" /><path d="M9.5 6a10 10 0 0 1 0 12" /><path d="M13 3.5a14 14 0 0 1 0 17" /></svg>
                  <span className="nm">{worker.full_name || "Tu nombre"}</span>
                  <span className="rl">{worker.role_title}</span>
                  <span className="qr" dangerouslySetInnerHTML={{ __html: t.qrSvg }} />
                </div>
                <div className="label">{t.label} · {t.code}{t.active ? "" : " · desactivada"}</div>
                <div className="tagurl">
                  <code>{t.url}</code>
                  <button type="button" onClick={() => copy(t.url)}>{copied === t.url ? "¡Copiado!" : "Copiar"}</button>
                </div>
                <div className="tagactions">
                  <a className="smallbtn" href={`/t/${t.code}`} target="_blank" rel="noreferrer">Probar como cliente</a>
                  <button className="smallbtn" type="button" onClick={() => toggleTag(t)}>{t.active ? "Desactivar (la perdí)" : "Activar"}</button>
                </div>
              </div>
            ))}
            <details className="box">
              <summary>Cómo grabar tu link en la etiqueta NFC</summary>
              <ol className="howto" style={{ marginTop: 10 }}>
                <li>Instala la app gratuita <b>NFC Tools</b> (iPhone o Android).</li>
                <li>Copia tu link de arriba.</li>
                <li>En NFC Tools: <b>Escribir → Agregar un registro → URL/URI</b> y pega el link.</li>
                <li>Toca <b>Escribir</b> y acerca la etiqueta a la parte de arriba del celular.</li>
                <li>Pruébala: acerca otro celular a la etiqueta y debe abrir tu página de propina.</li>
              </ol>
            </details>
            {tags.length < 10 && (
              <button className="btn btn-line" type="button" onClick={addTag}>Agregar otra tarjeta</button>
            )}
          </div>
        </section>

        <section className="sec">
          <h2>Movimientos</h2>
          <div className="box">
            {moves.length === 0 ? (
              <p className="empty">Aún no tienes propinas. Prueba tu tarjeta con otro celular.</p>
            ) : (
              <ul className="acts">
                {moves.map((m) => (
                  <li key={m.id} className={m.id === fresh ? "fresh" : undefined}>
                    <span>
                      {m.kind === "tip" ? "Propina" : `Retiro a ${WITHDRAW_LABEL[m.w.method]}`}
                      <small>
                        {dayLabel(m.at)} · {hhmm(m.at)}
                        {m.kind === "tip" && m.t.rating ? ` · ${"★".repeat(m.t.rating)}` : ""}
                        {m.kind === "tip" && m.t.fee_covered ? " · comisión cubierta por el cliente" : ""}
                      </small>
                    </span>
                    <span className={`m${m.cents < 0 ? " neg" : ""}`}>{m.cents < 0 ? "−" : "+"}{money(Math.abs(m.cents))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="sec">
          <h2>Mi perfil</h2>
          <details className="box">
            <summary>Editar cómo me ven los clientes</summary>
            <form className="profile-form" onSubmit={saveProfile}>
              <label className="field"><span>Nombre</span><input className="input" id="pf-name" name="full_name" defaultValue={worker.full_name} required /></label>
              <label className="field"><span>Qué hago</span><input className="input" id="pf-role" name="role_title" defaultValue={worker.role_title} /></label>
              <label className="field"><span>Dónde trabajo</span><input className="input" id="pf-place" name="place" defaultValue={worker.place} /></label>
              <button className="btn btn-jade">Guardar</button>
            </form>
          </details>
        </section>
      </div>

      {sheet && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setSheet(false)}>
          <div className="sheet" role="dialog" aria-label="Retirar saldo">
            <h3>¿A dónde retiras {money(worker.balance_cents)}?</h3>
            {WITHDRAW.map((o) => (
              <button key={o.id} className="opt" type="button" disabled={worker.balance_cents <= o.fee} onClick={() => withdraw(o.id)}>
                <span>{o.title}<small>{o.sub}</small></span>
                <b>{o.fee ? money(o.fee) : "Gratis"}</b>
              </button>
            ))}
            {demoMode && <p className="note">Modo demo: el retiro se registra pero no se envía dinero.</p>}
            {err && <p className="err">{err}</p>}
            <button className="cancel" type="button" onClick={() => setSheet(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </main>
  );
}
