import { TravelPlannerForm } from "@/components/TravelPlannerForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Event Travel Planner
          </h1>
          <p className="text-lg text-muted-foreground">
            Plan your event trips with AI-powered flight and hotel recommendations
          </p>
        </div>
        <TravelPlannerForm />
      </main>
    </div>
  );
}
