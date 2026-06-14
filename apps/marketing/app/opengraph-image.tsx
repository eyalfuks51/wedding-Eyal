import { ImageResponse } from "next/og";

export const alt = "Guesto, הזמנה דיגיטלית לחתונה";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "rgb(248, 246, 252)",
          color: "rgb(38, 33, 51)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: 80,
          textAlign: "center",
          width: "100%",
        }}
      >
        <div style={{ color: "rgb(109, 40, 217)", fontSize: 38, marginBottom: 34 }}>
          Guesto
        </div>
        <div style={{ direction: "rtl", fontSize: 78, fontWeight: 800, lineHeight: 1.18 }}>
          הזמנה דיגיטלית לחתונה, מוכנה לשליחה תוך כמה דקות
        </div>
      </div>
    ),
    size,
  );
}
