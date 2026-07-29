import { Suspense } from "react";
import STSStandingOrder from "./STSStandingOrder";

export default function STSStandingOrderPage() {
    return (
        <div >
            {/* Sidebar */}
            <Suspense
                fallback={
                    <div >
                        <p className="text-white/60">
                            Loading STS Standing Order page…
                        </p>
                    </div>
                }
            >
                <STSStandingOrder />
            </Suspense>
        </div>
    );
}
