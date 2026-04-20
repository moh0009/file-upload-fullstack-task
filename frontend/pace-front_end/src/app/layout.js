import { Inter } from "next/font/google";
import "./globals.css";
import logo from "../../public/logo.png";

export const metadata = {
  title: "PACE | Smart Student Data Management",
  description: "Upload, process, and analyze student datasets with lightning speed and premium security using PACE.",
  keywords: ["student data", "file upload", "analytics", "education management", "data processing"],
};

import { NotificationProvider } from "../../context/NotificationContext";

const inter = Inter({
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        <link rel="icon" href={logo} />
        <meta name="description" content={metadata.description} />
        <meta name="keywords" content={metadata.keywords.join(", ")} />
        <title>{metadata.title}</title>
      </head>
      <body className={inter.className}>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
