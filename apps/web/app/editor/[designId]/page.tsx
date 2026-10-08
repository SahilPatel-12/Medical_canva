import { Metadata } from "next";
import { EditorClient } from "./EditorClient";

export const metadata: Metadata = {
  title: "Design Editor | BioCanvas",
  description: "Visual design editor for figures, models, and presentations.",
};

interface EditorPageProps {
  params: Promise<{ designId: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { designId } = await params;
  return <EditorClient designId={designId} />;
}
