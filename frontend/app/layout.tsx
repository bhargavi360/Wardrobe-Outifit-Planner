import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { ToastProvider } from "../components/ToastProvider";
import { AuthProvider } from "./providers";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300"],
  style: ["normal", "italic"],
  variable: "--font-thread-serif",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300"],
  variable: "--font-thread-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thread",
  description: "A private digital wardrobe for considered everyday dressing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${cormorant.variable} ${manrope.variable}`}>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
