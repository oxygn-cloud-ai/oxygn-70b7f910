import React from 'react';
import { navItems } from '../nav-items';

const Navbar = ({ handleNavigation }) => {
  return (
    <nav className="bg-gray-800 text-white p-4">
      <ul className="flex space-x-4">
        {navItems.filter(item => !item.hidden).map((item) => (
          <li key={item.to}>
            <button
              onClick={() => handleNavigation(item.to)}
              className="flex items-center hover:text-gray-300"
            >
              {item.icon}
              <span className="ml-2">{item.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;