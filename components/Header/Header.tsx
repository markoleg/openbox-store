import Link from "next/link";
import Image from "next/image";
import Logout from "@/components/Header/Logout/Logout";
import { cookies } from "next/headers";
import styles from "./Header.module.css"
import AppToggle from "./AppToggle/AppToggle";
import { sessionCookieName, verifyOwnerSession } from '@/lib/ownerSession';
import ZhezhemonNavigation from '@/components/ZheZhemon/Review/ZhezhemonNavigation';

export default async function Header() {
  let authorized = false;
  try {
    authorized = await verifyOwnerSession((await cookies()).get(sessionCookieName())?.value);
  } catch { /* Login remains renderable before session configuration. */ }
  return (
    <header className={styles.header}>
      <div className={styles.navbar_wrp}>
        <Link href="/" className={styles.brand}>
          <Image
            className={styles.logo}
            src="/images/OpenBoxStore.jpg"
            alt="OpenBox Store logo"
            width={40}
            height={40}
          />
          <span>
            <b>OpenBox</b>
            <br></br>
            <small> web dashboard</small>
          </span>
        </Link>
        <AppToggle />
        <ZhezhemonNavigation placement="header" />

        {authorized ? (
          <Logout />
        ) : (
          <div></div>
        )}
      </div>
    </header>
  );
}
