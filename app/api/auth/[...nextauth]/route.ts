import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

// Comprehensive debug logging
console.log('=== NextAuth Environment Check ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('Has NEXTAUTH_SECRET:', !!process.env.NEXTAUTH_SECRET);
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID?.substring(0, 30) + '...');
console.log('GOOGLE_CLIENT_ID length:', process.env.GOOGLE_CLIENT_ID?.length);
console.log('Has GOOGLE_CLIENT_SECRET:', !!process.env.GOOGLE_CLIENT_SECRET);
console.log('GOOGLE_CLIENT_SECRET length:', process.env.GOOGLE_CLIENT_SECRET?.length);
console.log('ALLOWED_DOMAINS:', process.env.ALLOWED_DOMAINS);
console.log('Has SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Has SUPABASE_SERVICE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('=================================');

const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',') || [];

// Helper function to get Supabase client
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase configuration missing:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey
    });
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
      console.log('=== SIGN IN ATTEMPT ===');
      console.log('User:', {
        email: user.email,
        name: user.name,
        id: user.id
      });
      console.log('Account provider:', account?.provider);
      
      const email = user.email || '';
      const domain = email.split('@')[1];
      
      console.log('Email domain:', domain);
      console.log('Allowed domains:', allowedDomains);
      
      // First check if email domain is in allowed list
      if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
        console.log(`SIGN IN DENIED: Domain ${domain} not in allowed domains`);
        return false;
      }
      
      console.log('Domain check passed');
      
      // Get Supabase client
      const supabase = getSupabaseClient();
      
      // If Supabase is not configured, fall back to domain-only check
      if (!supabase) {
        console.warn('SUPABASE NOT CONFIGURED - allowing based on domain only');
        return true;
      }
      
      // Check if user is in the allowlist table
      try {
        console.log('Checking Supabase allowlist for:', email);
        
        const { data: allowedUser, error } = await supabase
          .from('allowed_users')
          .select('email, is_active, role')
          .eq('email', email)
          .eq('is_active', true)
          .single();
        
        console.log('Supabase query result:', {
          found: !!allowedUser,
          error: error?.message,
          userData: allowedUser
        });
        
        if (error) {
          if (error.code === 'PGRST116') {
            console.log('User not found in allowlist');
          } else {
            console.error('Supabase query error:', error);
          }
          return false;
        }
        
        if (!allowedUser) {
          console.log(`SIGN IN DENIED: Email ${email} not in allowlist`);
          return false;
        }
        
        console.log(`SIGN IN ALLOWED: ${email} (role: ${allowedUser.role})`);
        return true;
      } catch (error) {
        console.error('ERROR checking allowlist:', error);
        return false;
      }
    },
    async session({ session, token }) {
      console.log('=== SESSION CALLBACK ===');
      console.log('Session user:', session.user?.email);
      
      if (session.user?.email) {
        const supabase = getSupabaseClient();
        
        if (supabase) {
          try {
            const { data: userData, error } = await supabase
              .from('allowed_users')
              .select('role')
              .eq('email', session.user.email)
              .single();
            
            if (userData) {
              session.user.role = userData.role;
              console.log('Added role to session:', userData.role);
            }
            
            if (error) {
              console.error('Error fetching user role:', error);
            }
          } catch (error) {
            console.error('Error in session callback:', error);
          }
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      console.log('=== JWT CALLBACK ===');
      if (account) {
        console.log('New sign in, persisting access token');
        token.accessToken = account.access_token;
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      console.log('=== REDIRECT CALLBACK ===');
      console.log('Redirect URL:', url);
      console.log('Base URL:', baseUrl);
      return url.startsWith(baseUrl) ? url : baseUrl;
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
  debug: true, // Enable NextAuth debug mode
  events: {
    async signIn(message) {
      console.log('EVENT: Sign in successful', message.user.email);
    },
    async signOut(message) {
      console.log('EVENT: Sign out');
    },
    async createUser(message) {
      console.log('EVENT: User created', message.user.email);
    },
    async linkAccount(message) {
      console.log('EVENT: Account linked');
    },
    async session(message) {
      // This would be too noisy
    },
    async error(error) {
      console.error('EVENT: NextAuth error', error);
    }
  }
};

// Additional error logging for the handler
try {
  const handler = NextAuth(authOptions);
  console.log('NextAuth handler created successfully');
  module.exports = { GET: handler, POST: handler };
} catch (error) {
  console.error('CRITICAL: Failed to create NextAuth handler:', error);
  throw error;
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };