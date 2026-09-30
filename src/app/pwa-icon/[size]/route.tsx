import { ImageResponse } from "next/og";

// Íconos PNG para el manifest de la PWA (192 y 512)
export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await ctx.params;
  const px = size === "512" ? 512 : 192;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0E2A21", color: "#3DBE8E", fontSize: px * 0.62, fontWeight: 800 }}>
        t
      </div>
    ),
    { width: px, height: px },
  );
}
