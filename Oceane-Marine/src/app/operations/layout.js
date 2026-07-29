import OperationsLayoutClient from "./OperationsLayoutClient";

export const metadata = {
  title: "Operations | STS Management",
};

export default function OperationsLayout({ children }) {
  return <OperationsLayoutClient>{children}</OperationsLayoutClient>;
}

