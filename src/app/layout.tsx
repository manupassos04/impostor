import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Impostor 🕵️',
  description: 'O jogo do impostor para jogar com os amigos!',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
