import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CustomerForm } from "@/components/forms/customer-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCustomerAction } from "@/features/customers/actions";
import { getCurrentBusinessContext } from "@/lib/auth/server";

export default async function NewCustomerPage() {
  const businessContext = await getCurrentBusinessContext();

  if (!businessContext.currentBusiness) {
    redirect("/onboarding" as Route);
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href={"/customers" as Route}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Customers
          </Link>
        </Button>
        <h1 className="mt-4 text-2xl font-semibold leading-tight sm:text-3xl">
          Add customer
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Save the basic contact details you already know. Email and phone are optional.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerForm action={createCustomerAction} submitLabel="Create customer" />
        </CardContent>
      </Card>
    </main>
  );
}
