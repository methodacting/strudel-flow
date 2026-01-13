import { createAuthClient } from "better-auth/react";
import { anonymousClient, organizationClient } from "better-auth/client/plugins";

export const VITE_BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");
export const client = createAuthClient({
  baseURL: VITE_BACKEND_URL,
  basePath: "/auth",
  plugins: [anonymousClient(), organizationClient()],
  fetchOptions: {
    credentials: "include",
  },
});

export const signInWithGoogle = () => {
  return client.signIn.social({ provider: "google" });
};

export const signInWithGithub = () => {
  return client.signIn.social({ provider: "github" });
};

export const signInAnonymous = () => {
  return client.signIn.anonymous();
};

export const signOut = () => {
  return client.signOut();
};

export const getSession = () => {
  return client.getSession();
};


export type Session = {
  user: {
    id: string;
    name?: string;
    email?: string;
    image?: string;
  };
  session: {
    id: string;
    expiresAt: Date;
  };
};
