import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { navItems } from '../nav-items';

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="bg-gray-800 text-white p-4">
      <ul className="flex space-x-4">
        {navItems.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className={`flex items-center ${
                location.pathname === item.to ? 'text-blue-400' : 'text-white'
              } hover:text-blue-300 transition-colors`}
            >
              {item.icon}
              <span className="ml-2">{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;
