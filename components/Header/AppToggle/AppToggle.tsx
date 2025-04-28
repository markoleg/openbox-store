'use client';

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "../Header.module.css"
import { ChevronsUpDown } from 'lucide-react';
import Link from "next/link";



export default function AppToggle() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const handleToggle = () => {
        setIsOpen(!isOpen);
    };
    // add event listener to close the menu when clicking outside of it
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest(`.${styles.app_toggle_wrp}`)) {
            setIsOpen(false);
        }
    };
    // add event listener to close the menu when clicking outside of it
    useEffect(() => {
        document.addEventListener("click", handleClickOutside);
        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    }, []);
    return (
        <div className={styles.app_toggle_wrp}>
            <button onClick={handleToggle} className={styles.app_toggle}>
                <span>
                    {pathname.startsWith("/zhezhemon") ? "ZheZhemon" : pathname.startsWith("/newzhe") ? "NewZhe" : pathname.startsWith("/zhezheka") ? "ZheZheka" : "Select App"}
                </span>
                <ChevronsUpDown color="lightgray" size={13} />
            </button>
            {isOpen && (
                <ul className={styles.apps_list}>
                    <li >
                        <button onClick={handleToggle} className={pathname.startsWith("/zhezhemon") ? styles.active : ""}>
                            <Link href={"/zhezhemon"} className={styles.app_toggle_link}>
                                <span>
                                    ZheZhemon
                                </span>
                            </Link>

                        </button>
                    </li>
                    <li >
                        <button onClick={handleToggle} className={pathname.startsWith("/newzhe") ? styles.active : ""}>
                            <Link href={"/newzhe"} className={styles.app_toggle_link}>
                                <span>
                                    NewZhe
                                </span>
                            </Link>

                        </button>
                    </li>
                    <li >
                        <button onClick={handleToggle} className={pathname.startsWith("/zhezheka") ? styles.active : ""}>
                            <Link href={"/zhezheka"} className={styles.app_toggle_link}>
                                <span>
                                    ZheZheka
                                </span>
                            </Link>

                        </button>
                    </li>
                </ul>
            )}
        </div>
    )
}
