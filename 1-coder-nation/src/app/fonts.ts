import { IBM_Plex_Sans_Arabic, JetBrains_Mono, Noto_Kufi_Arabic } from "next/font/google";

// Headings: geometric Kufi gives the page a technical, distinctive voice.
const kufi = Noto_Kufi_Arabic({
  subsets: ["arabic", "latin"],
  variable: "--font-kufi",
  display: "swap",
});

// Body: highly readable Arabic with a "tech" skeleton (same family as the Latin IBM Plex).
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-ar",
  display: "swap",
});

// Code / small technical labels.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb-mono",
  display: "swap",
});

/** One class string for <html>: the public site and the admin panel share the same type system. */
export const fontVariables = `${kufi.variable} ${plex.variable} ${mono.variable}`;
