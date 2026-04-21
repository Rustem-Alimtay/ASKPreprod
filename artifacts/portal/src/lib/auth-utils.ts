export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// Redirect to login with a toast notification
export function redirectToLogin(toast?: (options: { title: string; description: string; variant: string }) => void) {
  if (toast) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
  }
  setTimeout(() => {
    const loginUrl = API_BASE ? `${API_BASE.replace(/\/$/, "")}/api/login` : "/api/login";
    window.location.href = loginUrl;
  }, 500);
}