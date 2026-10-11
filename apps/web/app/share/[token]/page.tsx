import { Metadata } from "next";
import { ShareClient } from "./ShareClient";

export const metadata: Metadata = {
  title: "Shared Design | BioCanvas",
  description: "View and collaborate on shared visual designs.",
};

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  return <ShareClient token={token} />;
}
