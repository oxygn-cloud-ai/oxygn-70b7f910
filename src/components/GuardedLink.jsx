import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApiCallContext } from '@/contexts/ApiCallContext';

/**
 * A wrapper around react-router's Link that checks for in-progress API calls.
 * If calls are running, it shows a confirmation dialog instead of navigating.
 */
const GuardedLink = React.forwardRef(({ to, children, onClick, ...props }, ref) => {
  const navigate = useNavigate();
  const { requestNavigation } = useApiCallContext();

  const handleClick = (e) => {
    // Let the caller's onClick run first
    if (onClick) onClick(e);
    if (e.defaultPrevented) return;

    // Prevent default Link behavior
    e.preventDefault();

    // Request navigation - if calls in progress, dialog will show
    requestNavigation(to, () => navigate(to));
  };

  return (
    <Link ref={ref} to={to} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
});

GuardedLink.displayName = 'GuardedLink';

export default GuardedLink;
