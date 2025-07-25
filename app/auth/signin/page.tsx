'use client';

import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, AlertCircle } from 'lucide-react';

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');

  // More detailed error messages
  const getErrorMessage = (error: string | null) => {
    if (!error) return null;
    
    const errorMessages: Record<string, string> = {
      'OAuthSignin': 'Failed to start OAuth sign-in process. Check your OAuth configuration.',
      'OAuthCallback': 'OAuth callback failed. This usually means invalid credentials or redirect URI mismatch.',
      'OAuthCreateAccount': 'Failed to create account. Your email might not be allowed.',
      'EmailCreateAccount': 'Failed to create account with this email.',
      'Callback': 'Callback error. Check your redirect URIs.',
      'OAuthAccountNotLinked': 'This email is already associated with another account.',
      'EmailSignin': 'Failed to send sign-in email.',
      'CredentialsSignin': 'Sign in failed. Check your credentials.',
      'SessionRequired': 'You must be signed in to access this page.',
      'AccessDenied': 'Access denied. Your email is not on the allowlist.',
      'Configuration': 'Server configuration error. Check environment variables.',
      'Default': 'An unexpected error occurred during sign in.'
    };
    
    return errorMessages[error] || `Unknown error: ${error}`;
  };

  const errorMessage = getErrorMessage(error);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Building2 className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Maintenance Bid Calculator</CardTitle>
          <CardDescription>
            Sign in with your company Google account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Sign in failed</div>
                <div className="text-sm">{errorMessage}</div>
                {error && (
                  <div className="text-xs mt-2 font-mono bg-red-50 p-2 rounded">
                    Error code: {error}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          <Button
            onClick={() => {
              console.log('Sign in button clicked');
              console.log('Callback URL:', callbackUrl);
              signIn('google', { callbackUrl });
            }}
            className="w-full"
            size="lg"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </Button>
          
          <div className="space-y-2 text-sm text-gray-500 text-center">
            <p>Only company email addresses are allowed</p>
            {process.env.NODE_ENV === 'development' && (
              <details className="text-xs text-left">
                <summary className="cursor-pointer text-center">Debug Info</summary>
                <pre className="mt-2 bg-gray-100 p-2 rounded overflow-auto">
{JSON.stringify({
  error,
  callbackUrl,
  currentUrl: typeof window !== 'undefined' ? window.location.href : 'SSR',
}, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-pulse">
              <div className="h-12 w-12 bg-gray-200 rounded mx-auto mb-4"></div>
              <div className="h-8 bg-gray-200 rounded mb-4"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}