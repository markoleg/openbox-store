import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css'
import { ItemsProvider } from '@/context/ItemsProvider'


export default async function Layout({ children }: { children: React.ReactNode }) {

    return (
        <div className="page-wrp">
            <ItemsProvider>
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