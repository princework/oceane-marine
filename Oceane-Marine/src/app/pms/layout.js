import PmsLayoutClient from "./PmsLayoutClient";

export const metadata = {
  title: "PMS | STS Management",
};

export default function PmsLayout({ children }) {
  return <PmsLayoutClient>{children}</PmsLayoutClient>;
}

