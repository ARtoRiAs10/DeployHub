import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'DeployHub — Deploy Anything, Instantly',
  description: 'Zero-config deployments. Push your GitHub repo or ZIP to EC2 or S3 in seconds.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn("font-sans", inter.variable)}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
