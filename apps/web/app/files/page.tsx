import { Metadata } from "next";
import { FilesDashboard } from "../../features/files";

export const metadata: Metadata = {
  title: "My Files | BioCanvas Design Studio",
  description: "Browse, create, and manage your visual designs and scientific illustrations.",
};

export default function FilesPage() {
  return <FilesDashboard />;
}
