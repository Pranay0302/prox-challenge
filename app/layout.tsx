import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OmniPro 220 Assistant",
  description:
    "Multimodal expert assistant for the Vulcan OmniPro 220 multiprocess welder.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Cinematic backdrop: cool misty haze, a warm horizon glow, dark
            vignette framing, and film grain. */}
        <div className="bg" aria-hidden="true">
          <div className="glow" />
          <div className="vignette" />
          <div className="grain" />
        </div>
        {children}
      </body>
    </html>
  );
}
