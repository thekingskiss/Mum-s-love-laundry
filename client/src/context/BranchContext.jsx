import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext.jsx';

const BranchContext = createContext(null);

// Only meaningfully used by staff/admin who can switch branches — a
// super_admin has branch_id = null (all branches), so they're the only role
// whose client-side filter selection actually changes what the server
// returns; laundry_staff/administrator are always forced to their own
// branch server-side regardless of this value.
export function BranchProvider({ children }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [currentBranchId, setCurrentBranchId] = useState('');

  useEffect(() => {
    if (!user) {
      setBranches([]);
      return;
    }
    api
      .get('/branches')
      .then(({ data }) => setBranches(data.branches))
      .catch(() => setBranches([]));
  }, [user]);

  const value = useMemo(
    () => ({ branches, currentBranchId, setCurrentBranchId, isSuperAdmin: user?.role === 'super_admin' }),
    [branches, currentBranchId, user?.role]
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within a BranchProvider');
  return ctx;
}
