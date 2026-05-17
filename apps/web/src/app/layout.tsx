import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Earthropy',
  description:
    'Earth + Entropy = Earthropy. A neutral, forever-free platform for coordinating global action on the 17 UN Sustainable Development Goals.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
