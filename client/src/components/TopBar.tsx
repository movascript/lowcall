import type { ReactNode } from "react";

const TopBar = ({ children }: { children: ReactNode }) => {
  return (
    <div className="absolute flex justify-between top-[max(1rem,env(safe-area-inset-top))] left-4 right-4 z-floating">
      {children}
    </div>
  );
};

export default TopBar;
