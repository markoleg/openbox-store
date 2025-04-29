import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css'
import { ItemsProvider } from '@/context/ItemsProvider'
import AsideMenu from '@/components/AsideMenu/AsideMenu'


export default async function Layout({ children }: { children: React.ReactNode }) {

    return (
        <div className="page-wrp">
            <ItemsProvider>
                <AsideMenu />
                {children}
            </ItemsProvider>
            <ToastContainer
                position="bottom-right"
                autoClose={60000}
                hideProgressBar={false}
                newestOnTop={true}
                // closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
            />
        </div>
    )
}