import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0E2A21", color: "#3DBE8E", fontSize: 120, fontWeight: 800 }}>
        t
      </div>
    ),
    size,
  );
}
