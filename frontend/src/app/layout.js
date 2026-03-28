import './globals.css';
import ClientSidebar from './ClientSidebar';
import { AuthProvider } from './AuthContext';

export const metadata = {
  title: 'Similarity Engine',
  description: 'C/C++ Code Analysis Tool',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex h-screen bg-gray-50 text-gray-900">
        <AuthProvider>
          <ClientSidebar />
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}