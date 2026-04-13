import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User, Phone, Mail, Calendar, Users, Globe, Briefcase, Building2 } from "lucide-react";
import type { CustomerWithProfile } from "@shared";

export default function CustomerProfilePage() {
  const params = useParams();
  const customerId = params.id;

  const { data: customer, isLoading, error } = useQuery<CustomerWithProfile>({
    queryKey: ["/api/customers", customerId],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Customer not found");
      return res.json();
    },
    enabled: !!customerId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-60" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardContent className="flex flex-col items-center gap-4 pt-6">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-5 w-20" />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-6 h-[50vh]">
        <h2 className="text-xl font-semibold">Customer Not Found</h2>
        <p className="text-muted-foreground">The customer record you're looking for doesn't exist.</p>
        <Link href="/applications/customer-db">
          <Button data-testid="button-back-to-list">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
        </Link>
      </div>
    );
  }

  const isIndividual = customer.type === "Individual";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/applications/customer-db">
          <Button variant="ghost" size="icon" data-testid="button-back-to-list">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Customer Profile</h1>
          <p className="text-muted-foreground">View detailed customer information</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <div className={`flex h-24 w-24 items-center justify-center rounded-full ${isIndividual ? "bg-blue-100 dark:bg-blue-900/30" : "bg-purple-100 dark:bg-purple-900/30"}`}>
              {isIndividual ? (
                <User className="h-12 w-12 text-blue-600 dark:text-blue-400" />
              ) : (
                <Building2 className="h-12 w-12 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold">{customer.firstName} {customer.lastName}</h2>
              <Badge
                className={`mt-2 ${
                  isIndividual
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"
                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0"
                }`}
              >
                {customer.type}
              </Badge>
            </div>
            <Separator className="my-2" />
            <div className="w-full space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{customer.contact}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="break-all">{customer.email}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Customer Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Full Name</span>
                </div>
                <p className="font-medium" data-testid="text-customer-name">{customer.firstName} {customer.lastName}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>Phone Number</span>
                </div>
                <p className="font-medium" data-testid="text-customer-phone">{customer.contact}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>Email Address</span>
                </div>
                <p className="font-medium" data-testid="text-customer-email">{customer.email}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Date of Birth</span>
                </div>
                <p className="font-medium" data-testid="text-customer-dob">{customer.profile?.dateOfBirth || "N/A"}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Gender</span>
                </div>
                <p className="font-medium" data-testid="text-customer-gender">{customer.profile?.gender || "N/A"}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span>Country of Nationality</span>
                </div>
                <p className="font-medium" data-testid="text-customer-nationality">{customer.profile?.nationality || "N/A"}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  <span>Occupation</span>
                </div>
                <p className="font-medium" data-testid="text-customer-occupation">{customer.profile?.occupation || "N/A"}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>Primary Unit</span>
                </div>
                <p className="font-medium" data-testid="text-customer-unit">{customer.primaryUnit}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-start">
        <Link href="/applications/customer-db">
          <Button variant="outline" data-testid="button-back-to-list-bottom">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to List
          </Button>
        </Link>
      </div>
    </div>
  );
}
