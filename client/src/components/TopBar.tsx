import type { ReactNode } from "react";

const TopBar = ({ children }: { children: ReactNode }) => {
  return (
    <div className="absolute display flex justify-between top-4 left-4 right-4 z-30">
      {children}
    </div>
  );
};

export default TopBar;
