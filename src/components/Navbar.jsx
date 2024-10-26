import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { navItems } from '../nav-items';

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="bg-white p-4">
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
                className={`flex items-center px-3 py-2 rounded-md ${
                  location.pathname === item.to 
                    ? 'bg-white text-gray-800' 
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                {item.icon}
                <span className="ml-2">{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;