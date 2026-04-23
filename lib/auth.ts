import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

const DEBUG = process.env.NODE_ENV !== 'production' || process.env.NEXTAUTH_DEBUG === 'true';
const debugLog = (...args: unknown[]) => { if (DEBUG) console.log(...args); };

if (DEBUG) {
  console.log('=== NextAuth Environment Check ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
  console.log('Has NEXTAUTH_SECRET:', !!process.env.NEXTAUTH_SECRET);
  console.log('Has GOOGLE_CLIENT_ID:', !!process.env.GOOGLE_CLIENT_ID);
  console.log('Has GOOGLE_CLIENT_SECRET:', !!process.env.GOOGLE_CLIENT_SECRET);
  console.log('ALLOWED_DOMAINS:', process.env.ALLOWED_DOMAINS);
  console.log('Has SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Has SUPABASE_SERVICE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('=================================');
}

const allowedDomains = process.env.ALLOWED_DOMAINS?.split(',').map(d => d.trim()).filter(Boolean) || [];

export const getSupabaseAdmin = () => {
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
    async signIn({ user, account }) {
      debugLog('=== SIGN IN ATTEMPT ===', { email: user.email, provider: account?.provider });

      const email = user.email || '';
      const domain = email.split('@')[1];

      if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
        debugLog(`SIGN IN DENIED: Domain ${domain} not in allowed domains`);
        return false;
      }

      const supabase = getSupabaseAdmin();

      if (!supabase) {
        console.warn('SUPABASE NOT CONFIGURED - allowing based on domain only');
        return true;
      }

      try {
        const { data: allowedUser, error } = await supabase
          .from('allowed_users')
          .select('email, is_active, role, login_count')
          .eq('email', email)
          .eq('is_active', true)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            debugLog('User not found in allowlist:', email);
          } else {
            console.error('Supabase query error:', error);
          }
          return false;
        }

        if (!allowedUser) {
          debugLog(`SIGN IN DENIED: Email ${email} not in allowlist`);
          return false;
        }

        debugLog(`SIGN IN ALLOWED: ${email} (role: ${allowedUser.role})`);

        try {
          const { error: updateError } = await supabase
            .from('allowed_users')
            .update({
              last_login: new Date().toISOString(),
              login_count: (allowedUser.login_count || 0) + 1
            })
            .eq('email', email);

          if (updateError) {
            console.error('Failed to update last login:', updateError);
          }
        } catch (err) {
          console.error('Error updating last login:', err);
        }

        return true;
      } catch (err) {
        console.error('ERROR checking allowlist:', err);
        return false;
      }
    },
    async session({ session, token }) {
      if (session.user && token.role) {
        session.user.role = token.role as string;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      // Cache the role on the JWT once, so session() doesn't hit Supabase on every request
      if (user?.email && !token.role) {
        const supabase = getSupabaseAdmin();
        if (supabase) {
          try {
            const { data: userData } = await supabase
              .from('allowed_users')
              .select('role')
              .eq('email', user.email)
              .single();
            if (userData?.role) {
              token.role = userData.role;
            }
          } catch (err) {
            console.error('Error fetching user role for JWT:', err);
          }
        }
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
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
  debug: DEBUG,
  events: {
    async signIn(message) {
      debugLog('EVENT: Sign in successful', message.user.email);
    },
    async signOut() {
      debugLog('EVENT: Sign out');
    },
    async createUser(message) {
      debugLog('EVENT: User created', message.user.email);
    },
    async linkAccount() {
      debugLog('EVENT: Account linked');
    }
  }
};
