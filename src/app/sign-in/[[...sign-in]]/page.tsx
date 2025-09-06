import { SignIn } from '@clerk/nextjs'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  )
}
