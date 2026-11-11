import { Limelight, Figtree, Space_Mono } from "next/font/google";
import "./globals.css";

const display = Limelight({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Figtree({ subsets: ["latin", "latin-ext"], variable: "--font-body" });
const mono = Space_Mono({ weight: ["400", "700"], subsets: ["latin", "latin-ext"], variable: "--font-mono" });

export const metadata = {
  title: "Filmski večer",
  description: "Predlagaj film brez naslova. Potem skupaj izberemo.",
};

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="sl" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
