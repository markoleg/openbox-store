import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css'
import { ShopItemsProvider } from '@/context/ShopItemsProvider'
import ShopAsideMenu from '@/components/ShopParser/AsideMenu/ShopAsideMenu'

export default async function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="page-wrp">
            <ShopItemsProvider>
                <ShopAsideMenu />
                {children}
            </ShopItemsProvider>
            <ToastContainer
                position="bottom-right"
                autoClose={60000}
                hideProgressBar={false}
                newestOnTop={true}
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
            />
        </div>
    )
}
