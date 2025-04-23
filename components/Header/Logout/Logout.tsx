"use client";
import { serialize } from "cookie";
import styles from "../Header.module.css"
import { LogOut } from 'lucide-react';

export default function Loogout({ cookiename }: { cookiename: string }) {
  const cookie = serialize(cookiename, "false", {
    httpOnly: false,
    path: "/",
    maxAge: 86400 * 7 * 2, // 2 weeks in seconds
  });
  const handleLogOut = () => {
    document.cookie = cookie;
    window.location.reload();
  };

  return (
    <button className={styles.logout} onClick={handleLogOut}>
      log out
      <LogOut size={13} />
    </button>
  );
}
