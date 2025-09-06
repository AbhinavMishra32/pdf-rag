import { SignUp } from '@clerk/nextjs'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up',
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  )
}
