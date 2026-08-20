export const metadata = {
  title: 'Hospital AI OS',
  description: 'Hospital AI OS Frontend',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
