import Image from "next/image";
import AsideMenu from "@/components/ZheZhemon/AsideMenu/AsideMenu";

export default function Home() {
  const asideMenuList = [
    { name: "Item 1", path: "/item1" },
    { name: "Item 2", path: "/item2" },
    { name: "Item 3", path: "/item3" },
  ];
  return (
    <div className="page-wrp">
      {/* <AsideMenu list={asideMenuList} /> */}
      <main>
      </main>
    </div>
  );
}
