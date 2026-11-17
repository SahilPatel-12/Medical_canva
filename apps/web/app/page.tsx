import type { Metadata } from "next";
import { LandingPage } from "../features/marketing/LandingPage";

export const metadata: Metadata = {
  title: "BioCanvas | Scientific figures everyone understands",
  description:
    "The visual workspace for doctors, researchers and educators. Create medical and life-science figures, slides and patient materials with editable scientific illustrations.",
};

export default function HomePage() {
  return <LandingPage />;
}
