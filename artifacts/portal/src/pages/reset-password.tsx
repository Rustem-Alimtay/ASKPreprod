import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutDashboard, Loader2, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/reset-password/:token");
  const token = params?.token || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const tokenValidation = useQuery({
    queryKey: ["/api/auth/validate-reset-token", token],
    queryFn: async () => {
      const res = await fetch(`/api/auth/validate-reset-token/${token}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid or expired reset link");
      }
      return data;
    },
    enabled: !!token,
    retry: false,
  });

  const resetMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reset password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
  const passwordValid = hasMinLength && hasUppercase && hasNumber && hasSpecial;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (!passwordValid) {
      toast({ title: "Password does not meet all requirements", variant: "destructive" });
      return;
    }
    resetMutation.mutate({ token, newPassword });
  }

  const tokenInvalid = tokenValidation.isError;
  const tokenLoading = tokenValidation.isLoading;
  const tokenErrorMessage = tokenValidation.error instanceof Error
    ? tokenValidation.error.message
    : "Invalid or expired reset link";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary">
            <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">
              {tokenInvalid ? "Invalid Link" : success ? "Password Reset" : "Set New Password"}
            </CardTitle>
            <CardDescription>
              {tokenInvalid
                ? tokenErrorMessage
                : success
                ? "Your password has been changed successfully"
                : "Enter your new password below"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {tokenLoading ? (
            <div className="flex flex-col items-center gap-3 py-4" data-testid="status-token-loading">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Validating reset link...</p>
            </div>
          ) : tokenInvalid ? (
            <div className="space-y-4" data-testid="status-token-invalid">
              <div className="flex flex-col items-center gap-3 py-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <p className="text-sm text-muted-foreground text-center">
                  This reset link is no longer valid. Please request a new one.
                </p>
              </div>
              <Link href="/forgot-password">
                <Button className="w-full" data-testid="button-request-new-link">
                  Request New Reset Link
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="ghost" className="w-full" data-testid="button-back-login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to login
                </Button>
              </Link>
            </div>
          ) : success ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-sm text-muted-foreground text-center">
                  You can now sign in with your new password.
                </p>
              </div>
              <Link href="/login">
                <Button className="w-full" data-testid="button-go-to-login">
                  Go to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  data-testid="input-reset-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  data-testid="input-reset-confirm-password"
                />
              </div>
              {newPassword.length > 0 && (
                <div className="space-y-1 text-xs">
                  <p className={hasMinLength ? "text-green-600" : "text-muted-foreground"}>
                    {hasMinLength ? "\u2713" : "\u2022"} At least 8 characters
                  </p>
                  <p className={hasUppercase ? "text-green-600" : "text-muted-foreground"}>
                    {hasUppercase ? "\u2713" : "\u2022"} One uppercase letter
                  </p>
                  <p className={hasNumber ? "text-green-600" : "text-muted-foreground"}>
                    {hasNumber ? "\u2713" : "\u2022"} One number
                  </p>
                  <p className={hasSpecial ? "text-green-600" : "text-muted-foreground"}>
                    {hasSpecial ? "\u2713" : "\u2022"} One special character
                  </p>
                </div>
              )}
              {newPassword.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters with uppercase, number, and special character.
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={resetMutation.isPending}
                data-testid="button-reset-submit"
              >
                {resetMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Reset Password
              </Button>
              <Link href="/login">
                <Button variant="ghost" className="w-full" data-testid="button-back-login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to login
                </Button>
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
