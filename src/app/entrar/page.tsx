"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BRAND_LOWER } from "@/lib/brand";

const ROLES = ["Mesero/a", "Camarista", "Valet parking", "Viene viene", "Cerillo", "Repartidor/a", "Barista", "Estilista", "Otro"];

function EntrarForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(params.get("modo") === "registro" ? "signup" : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "").trim();
    const password = String(f.get("password") || "");
    const supabase = createClient();
    setBusy(true);
    setError(null);
    setInfo(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
      router.replace("/panel");
      router.refresh();
      return;
    }

    const roleSel = String(f.get("role") || "");
    const role = roleSel === "Otro" ? String(f.get("role_other") || "").trim() : roleSel;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: String(f.get("full_name") || "").trim(),
          role_title: role,
          place: String(f.get("place") || "").trim(),
        },
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) {
      router.replace("/panel");
      router.refresh();
    } else {
      setInfo("Te enviamos un correo para confirmar tu cuenta. Ábrelo y vuelve a entrar.");
    }
  }

  const [roleSel, setRoleSel] = useState(ROLES[0]);

  return (
    <main className="auth">
      <div className="auth-card">
        <span className="wordmark">{BRAND_LOWER}</span>
        <h1>{mode === "login" ? "Entra a tu cuenta" : "Crea tu tarjeta de propinas"}</h1>
        <div className="tabs">
          <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")}>Entrar</button>
          <button type="button" aria-pressed={mode === "signup"} onClick={() => setMode("signup")}>Crear cuenta</button>
        </div>
        <form onSubmit={onSubmit}>
          {mode === "signup" && (
            <>
              <label className="field">
                <span>Tu nombre (así lo verá el cliente)</span>
                <input className="input" id="full_name" name="full_name" required placeholder="Juan Pérez" autoComplete="name" />
              </label>
              <label className="field">
                <span>¿A qué te dedicas?</span>
                <select className="input" id="role" name="role" value={roleSel} onChange={(e) => setRoleSel(e.target.value)}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              {roleSel === "Otro" && (
                <input className="input" id="role_other" name="role_other" required placeholder="Ej. Guía de turistas" />
              )}
              <label className="field">
                <span>¿Dónde trabajas?</span>
                <input className="input" id="place" name="place" placeholder="Ej. Estacionamiento Plaza Sur" />
              </label>
            </>
          )}
          <label className="field">
            <span>Correo</span>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input className="input" id="password" name="password" type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          {error && <p className="err">{error}</p>}
          {info && <p className="ok">{info}</p>}
          <button className="btn btn-rosa btn-block" disabled={busy}>
            {busy ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function EntrarPage() {
  return (
    <Suspense>
      <EntrarForm />
    </Suspense>
  );
}
