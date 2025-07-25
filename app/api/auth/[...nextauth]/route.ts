import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for server-side use
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Note: using service role key for server-side
);

const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',') || [];

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
      const email = user.email || '';
      const domain = email.split('@')[1];
      
      // First check if email domain is in allowed list
      if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
        console.log(`Sign in denied: Domain ${domain} not in allowed domains`);
        return false;
      }
      
      // Then check if user is in the allowlist table
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
    },
    async session({ session, token }) {
      // Optionally add user role to session
      if (session.user?.email) {
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
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };