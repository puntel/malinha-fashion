import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 transition-all duration-300 lg:ml-64 relative">
        {/* Adjusted left margin for sidebar. In a real app we might dynamicly adjust this if sidebar is collapsed, but let's stick to simple layout for now or fix sidebar width. */}
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
