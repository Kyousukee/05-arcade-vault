import { Suspense } from "react";
import LoginCard from "@/components/LoginCard";
export default function Auth() {
  return (
    <Suspense fallback={null}>
      <LoginCard />
    </Suspense>
  );
}
