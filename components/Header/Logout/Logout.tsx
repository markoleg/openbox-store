"use client";
import { useState } from 'react';
import styles from "../Header.module.css"
import { LogOut } from 'lucide-react';

export default function Logout() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const handleLogOut = async () => {
    setPending(true);
    setError(false);
    try {
      const response = await fetch('/api/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Logout failed');
      window.location.assign('/login');
    } catch {
      setError(true);
      setPending(false);
    }
  };

  return (
    <button className={styles.logout} onClick={handleLogOut} disabled={pending}>
      {error ? 'Retry log out' : 'log out'}
      <LogOut size={13} />
    </button>
  );
}
