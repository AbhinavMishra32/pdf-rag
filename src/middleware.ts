import { clerkMiddleware } from '@clerk/nextjs/server'

// Using default middleware; custom sign-in/up pages are provided at /sign-in and /sign-up
// Add conditional redirects here if you later want to gate specific routes.
export default clerkMiddleware()

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}