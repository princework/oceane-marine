import { Suspense } from "react";
import STSDeclarationForm from "./STSDeclarationForm";

export default function STSDeclarationFormPage() {
    return (
        <div >
            {/* Sidebar */}
            <Suspense
                fallback={
                    <div >
                        <p className="text-white/60">
                            Loading STS Declaration Form page…
                        </p>
                    </div>
                }
            >
                <STSDeclarationForm />
            </Suspense>
        </div>
    );
}
