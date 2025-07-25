import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

// Debug logging
console.log('NextAuth Configuration Check:', {
  hasGoogleId: !!process.env.GOOGLE_CLIENT_ID,
  hasGoogleSecret: !!process.env.GOOGLE_CLIENT_SECRET,
  hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
  nextAuthUrl: process.env.NEXTAUTH_URL,
  allowedDomains: process.env.ALLOWED_DOMAINS,
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});

const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',') || [];

// Helper function to get Supabase client
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase configuration missing');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "select_account"
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('Sign in attempt for:', user.email);
      
      const email = user.email || '';
      const domain = email.split('@')[1];
      
      // First check if email domain is in allowed list
      if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
        console.log(`Sign in denied: Domain ${domain} not in allowed domains`);
        return false;
      }
      
      // Get Supabase client
      const supabase = getSupabaseClient();
      
      // If Supabase is not configured, fall back to domain-only check
      if (!supabase) {
        console.warn('Supabase not configured, using domain-only authentication');
        return true; // Allow if domain matches
      }
      
      // TEMPORARY: Skip Supabase check for testing
      console.log('TEMPORARY: Skipping Supabase allowlist check');
      return true;
      
      // TEMPORARY: Skip Supabase check for testing
      console.log('TEMPORARY: Skipping Supabase allowlist check');
      return true;
      
      /* COMMENTED OUT FOR TESTING
      // Check if user is in the allowlist table
      try {
        const { data: allowedUser, error } = await supabase
          .from('allowed_users')
          .select('email, is_active')
          .eq('email', email)
          .eq('is_active', true)
          .single();
        
        if (error || !allowedUser) {
          console.log(`Sign in denied: Email ${email} not in allowlist`);
          return false;
        }
        
        console.log(`Sign in allowed: ${email}`);
        return true;
      } catch (error) {
        console.error('Error checking allowlist:', error);
        return false;
      }
      */
    },
    async session({ session, token }) {
      // Optionally add user role to session
      if (session.user?.email) {
        const supabase = getSupabaseClient();
        
        if (supabase) {
          try {
            const { data: userData } = await supabase
              .from('allowed_users')
              .select('role')
              .eq('email', session.user.email)
              .single();
            
            if (userData) {
              session.user.role = userData.role;
            }
          } catch (error) {
            console.error('Error fetching user role:', error);
          }
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true, // Enable debug mode
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };