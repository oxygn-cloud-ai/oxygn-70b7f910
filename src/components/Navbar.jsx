import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { navItems } from '../nav-items';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const Navbar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <nav className="bg-white text-gray-700 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <img 
            src="/head-striped-icon.png" 
            alt="Logo" 
            className="h-8 w-8 mr-4"
          />
          <ul className="flex space-x-4">
            {navItems.filter(item => !item.hidden).map((item) => (
              <li key={item.to}>
                <Link 
                  to={item.to} 
                  className={`flex items-center px-3 py-2 ${
                    location.pathname === item.to 
                      ? 'border-b-2 border-gray-700' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  <span className="ml-2">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        
        {user && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;