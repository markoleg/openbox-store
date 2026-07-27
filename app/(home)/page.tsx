import StatusWidget from '@/components/StatusWidget/StatusWidget';
import RedirectToShop from '@/components/RedirectToShop/RedirectToShop';

export default function Home() {
  return (
    <div>
        <RedirectToShop />
        <StatusWidget />
    </div>
  );
}
