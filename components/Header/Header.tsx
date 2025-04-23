import Link from "next/link";
import Image from "next/image";
import Logout from "@/components/Header/Logout/Logout";
import { cookies } from "next/headers";
import styles from "./Header.module.css"
import AppToggle from "./AppToggle/AppToggle";

export default async function Header() {
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

        {(await cookies()).has(process.env.PASSWORD_COOKIE_NAME!) &&
          (await cookies()).get(process.env.PASSWORD_COOKIE_NAME!)?.value === "true" ? (
          <Logout cookiename={process.env.PASSWORD_COOKIE_NAME!} />
        ) : (
          <div></div>
        )}
      </div>
    </header>
  );
}
