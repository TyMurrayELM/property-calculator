'use client';

import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, ChevronDown, Shield } from 'lucide-react';

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="h-10 px-3 py-2 rounded-md bg-gray-100 animate-pulse flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-gray-200" />
        <div className="h-4 w-20 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  // Get display name (first name or email prefix)
  const displayName = session.user.name?.split(' ')[0] || 
                     session.user.email?.split('@')[0] || 
                     'User';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 h-10 px-3 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
        >
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || 'User'}
              className="h-6 w-6 rounded-full object-cover"
              onError={(e) => {
                // If image fails to load, hide it
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div 
            className={`h-6 w-6 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs ${
              session.user.image ? 'hidden' : ''
            }`}
          >
            {displayName[0].toUpperCase()}
          </div>
          <span className="text-sm font-medium hidden sm:inline-block">
            {displayName}
          </span>
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                {displayName[0].toUpperCase()}
              </div>
            )}
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{session.user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {session.user.email}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        {(session.user as any).role === 'admin' && (
          <>
            <DropdownMenuItem 
              className="cursor-pointer"
              onClick={() => window.location.href = '/admin'}
            >
              <Shield className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}