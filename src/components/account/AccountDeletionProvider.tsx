import React, { createContext, useContext, useState } from 'react';

interface AccountDeletionContextType {
  isDeleting: boolean;
  setIsDeleting: (value: boolean) => void;
}

const AccountDeletionContext = createContext<AccountDeletionContextType>({
  isDeleting: false,
  setIsDeleting: () => {},
});

export const AccountDeletionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <AccountDeletionContext.Provider value={{ isDeleting, setIsDeleting }}>
      {children}
    </AccountDeletionContext.Provider>
  );
};

export function useAccountDeletion(): AccountDeletionContextType {
  return useContext(AccountDeletionContext);
}
