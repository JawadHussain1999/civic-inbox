import { LogOut, User as UserIcon, Building2 } from 'lucide-react';
import type { User } from '../types';

interface NavbarProps {
  user: User;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'staff': return 'bg-amber-55/60 text-amber-700 border border-amber-200';
      default: return 'bg-blue-50 text-blue-700 border border-blue-200';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center p-2 bg-slate-900 rounded-xl shadow-lg shadow-slate-900/10">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">
              Civic Inbox
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-slate-200 text-slate-700">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-tight">{user.name}</p>
                <p className="text-[10px] text-slate-500 font-medium leading-tight">
                  {user.role === 'staff' ? `${user.department} Staff` : user.role}
                </p>
              </div>
              <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full ${getRoleBadgeColor(user.role)}`}>
                {user.role}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center justify-center p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
