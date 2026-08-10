import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "line-bot-ai-Rose",
  description: "LINE OA chatbot backend (webhook only, no UI)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
