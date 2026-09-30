import Link from "next/link";
import { BRAND_LOWER } from "@/lib/brand";

export default function Home() {
  return (
    <main className="landing">
      <div className="landing-top">
        <span className="wordmark">{BRAND_LOWER}</span>
        <Link className="btn btn-line" href="/entrar">Entrar</Link>
      </div>
      <section>
        <h1>
          Propinas con <em>un toque</em>
        </h1>
        <p className="lede">
          Recibe propinas con una tarjeta NFC. Tu cliente acerca su celular, confirma con Apple Pay o Google Pay y el
          dinero llega a tu cuenta. Tu cliente no descarga nada.
        </p>
        <div className="ctas">
          <Link className="btn btn-rosa" href="/entrar?modo=registro">Crear mi tarjeta</Link>
          <Link className="btn btn-line" href="/entrar">Ya tengo cuenta</Link>
        </div>
      </section>
      <section className="how">
        <div>
          <h3>Tu tarjeta solo guarda un link</h3>
          <p>Cualquier etiqueta NFC sirve. La programas una vez con tu link personal y también puedes imprimir tu QR.</p>
        </div>
        <div>
          <h3>Tú eliges el monto</h3>
          <p>Cambia desde tu celular cuánto cobra tu tarjeta. El cambio aplica al instante, sin reprogramarla.</p>
        </div>
        <div>
          <h3>Te avisa al momento</h3>
          <p>Cada propina te llega con aviso y la ves en tu saldo. Retira por SPEI, Mercado Pago u OXXO.</p>
        </div>
      </section>
    </main>
  );
}
