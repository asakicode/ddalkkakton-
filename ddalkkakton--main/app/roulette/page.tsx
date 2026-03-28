import { Suspense } from "react";
import { RouletteContent } from "./roulette-content";

export default function RoulettePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pb-20 md:pb-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">로드 중...</p>
          </div>
        </div>
      }
    >
      <RouletteContent />
    </Suspense>
  );
}

