"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CoinsIcon } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pricing</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary">
              <CoinsIcon className="size-5" />
            </div>
            <div>
              <CardTitle>Credit Pricing Management</CardTitle>
              <CardDescription>
                Configure credit costs for your services
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pricing management allows you to set and adjust the credit cost for each of your
            services. This feature is coming soon -- you will be able to configure individual
            pricing per service, set promotional rates, and manage bulk pricing updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
