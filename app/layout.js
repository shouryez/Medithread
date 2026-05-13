import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'MediThread — India\'s Universal Patient Health Record',
  description: 'One ID. Every hospital. Your entire life.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#111520', color: '#e2e8f4', border: '1px solid #1e2a40' },
            success: { iconTheme: { primary: '#00e676', secondary: '#0b0e14' } },
            error: { iconTheme: { primary: '#ff5252', secondary: '#0b0e14' } },
          }}
        />
      </body>
    </html>
  )
}
