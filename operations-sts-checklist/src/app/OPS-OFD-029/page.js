import { Suspense } from "react";
import MooringMasterExpenseSheet from "./MooringMasterExpenseSheet";

export default function MooringMasterExpenseSheetPage() {
  return (
    <div >
      {/* Sidebar */}
      <Suspense
        fallback={
          <div >
            <p className="text-white/60">
              Loading Mooring Master Expense Sheet page…
            </p>
          </div>
        }
      >
        <MooringMasterExpenseSheet />
      </Suspense>
    </div>
  );
}
