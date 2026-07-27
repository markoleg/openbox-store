'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectToShop() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/shop');
    }, 2000);

    return () => clearTimeout(timeout);
  }, [router]);

  return null;
}
