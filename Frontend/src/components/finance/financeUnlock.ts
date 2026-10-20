// Finance unlock lives in memory (not storage): a page refresh locks Finance again.
// It survives moving between Finance pages and is cleared by lockFinance() when the user leaves Finance.
let unlockedUntil = 0;

export const getFinanceUnlockedUntil = () => unlockedUntil;
export const unlockFinance = (until: number) => {
  unlockedUntil = until;
};
export const lockFinance = () => {
  unlockedUntil = 0;
};
