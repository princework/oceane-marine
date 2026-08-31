const ALL_SIDEBAR_TABS = [
  {
    key: "documentation",
    label: "Inquiry",
    href: "/operations/sts-operations/new",
  },
  {
    key: "operation",
    label: "Operation Stages",
    submodules: [
      {
        key: "lined-up",
        label: "Lined Up",
        href: "/operations/sts-operations/new/operation/lined-up",
      },
      {
        key: "in-progress",
        label: "In Progress",
        href: "/operations/sts-operations/new/operation/in-progress",
      },
      {
        key: "completed",
        label: "Completed",
        href: "/operations/sts-operations/new/operation/completed",
      },
      {
        key: "cancelled",
        label: "Cancelled",
        href: "/operations/sts-operations/new/operation/cancelled",
      },
    ],
  },
  {
    key: "compatibility",
    label: "Compatibility",
    href: "/operations/sts-operations/new/compatibility",
  },
  {
    key: "forms",
    label: "Forms and checklist",
    submodules: [
      {
        key: "transfer-location-quest",
        label: "Transfer Location Questionnaire",
        href: "/operations/sts-operations/new/form-checklist/transfer-location-quest/list",
      },
      {
        key: "sts-checklist",
        label: "STS Checklist",
        href: "/operations/sts-operations/new/form-checklist/sts-checklist",
      },
      {
        key: "jpo",
        label: "JPO",
        href: "/operations/sts-operations/new/form-checklist/jpo/form",
      },
      // {
      //   key: "quotation",
      //   label: "Quotation",
      //   href: "/operations/sts-operations/new/form-checklist/quotations/sts-form",
      // },
      // {
      //   key: "inspection-checklist",
      //   label: "Inspection Checklist",
      //   href: "/operations/sts-operations/new/form-checklist/inspection-checklist/form",
      // },
      // {
      //   key: "manual",
      //   label: "Manual",
      //   href: "/operations/sts-operations/new/form-checklist/manual/form",
      // },
    ],
  },
  {
    key: "cargos",
    label: "Cargo types",
    href: "/operations/sts-operations/new/cargos",
    adminOnly: true,
  },
  {
    key: "clientsAgents",
    label: "Clients & agents",
    href: "/operations/sts-operations/new/clients-agents",
    adminOnly: true,
  },
  {
    key: "locations",
    label: "Locations",
    href: "/operations/sts-operations/new/locations",
    adminOnly: true,
  },
  {
    key: "mooring",
    label: "Mooring masters",
    href: "/operations/sts-operations/new/mooringmaster",
    adminOnly: true,
  },
];

const ADMIN_KEYS = new Set(["cargos", "clientsAgents", "locations", "mooring"]);

export function getSidebarTabs(isOpsAdmin) {
  if (isOpsAdmin) return ALL_SIDEBAR_TABS;
  return ALL_SIDEBAR_TABS.filter((t) => !ADMIN_KEYS.has(t.key));
}

/** Base path for "Forms and checklist" submodules (handles /sts-form, /form, /list, /admin suffixes). */
export function getFormsSubmoduleBasePath(submoduleHref) {
  if (!submoduleHref || typeof submoduleHref !== "string") return "";
  return (
    submoduleHref
      .replace(/\/sts-form$/, "")
      .replace(/\/form$|\/list$|\/admin$/, "") || submoduleHref
  );
}

/** True when pathname is the submodule default link or any route under its section (e.g. quotations/list). */
export function isFormsSubmoduleSidebarActive(pathname, submoduleHref) {
  const pathNorm = (pathname || "").replace(/\/$/, "");
  if (!pathNorm || !submoduleHref) return false;
  if (pathNorm === submoduleHref) return true;
  const base = getFormsSubmoduleBasePath(submoduleHref);
  return pathNorm.startsWith(`${base}/`);
}

export default ALL_SIDEBAR_TABS;
