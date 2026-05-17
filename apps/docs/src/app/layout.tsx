import type { ReactNode } from 'react';

export const metadata = {
  title: 'Earthropy Docs',
  description: 'Documentation for contributors, self-hosters, and integrators.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
