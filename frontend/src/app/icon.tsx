import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#dfff3f",
          borderRadius: 112,
        }}
      >
        <div
          style={{
            width: 280,
            height: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 140,
            border: "26px solid #11160f",
            color: "#11160f",
            fontSize: 194,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          B
        </div>
      </div>
    ),
    size,
  );
}
