import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutDashboard, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { Link } from "wouter";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const forgotMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
      return res.json();
    },
    onSuccess: (data) => {
      setSubmitted(true);
      if (data.token) {
        setResetLink(`${window.location.origin}/reset-password/${data.token}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast({ title: "Please enter your email", variant: "destructive" });
      return;
    }
    forgotMutation.mutate(email);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-primary">
            <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>
              {submitted
                ? "Check your email for the reset link"
                : "Enter your email to receive a password reset link"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-sm text-muted-foreground text-center">
                  If an account with that email exists, a reset link has been generated.
                </p>
              </div>
              {resetLink && (
                <div className="space-y-2 rounded-md border p-3 bg-muted/50">
                  <p className="text-xs font-medium text-muted-foreground">
                    Email sending is not configured. Use this link to reset your password:
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={resetLink}
                      className="text-xs"
                      data-testid="input-reset-link"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(resetLink);
                        toast({ title: "Link copied" });
                      }}
                      data-testid="button-copy-reset-link"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
              <Link href="/login">
                <Button variant="outline" className="w-full" data-testid="button-back-to-login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  data-testid="input-forgot-email"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={forgotMutation.isPending}
                data-testid="button-forgot-submit"
              >
                {forgotMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Send Reset Link
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
