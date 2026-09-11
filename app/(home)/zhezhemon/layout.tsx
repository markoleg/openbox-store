import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css'
import { ItemsProvider } from '@/context/ItemsProvider'
import ZhezhemonShell from '@/components/ZheZhemon/Review/ZhezhemonShell'


export default async function Layout({ children }: { children: React.ReactNode }) {

    return (
        <div>
            <ItemsProvider>
                <ZhezhemonShell>{children}</ZhezhemonShell>
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
