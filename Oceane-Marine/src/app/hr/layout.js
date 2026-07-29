import HrLayoutClient from "./HrLayoutClient";

export const metadata = {
  title: "HR | STS Management",
};

export default function HrLayout({ children }) {
  return <HrLayoutClient>{children}</HrLayoutClient>;
}
