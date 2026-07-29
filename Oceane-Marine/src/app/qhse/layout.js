import QhseLayoutClient from "./QhseLayoutClient";

export const metadata = {
  title: "QHSE | STS Management",
};

export default function QhseLayout({ children }) {
  return <QhseLayoutClient>{children}</QhseLayoutClient>;
}

