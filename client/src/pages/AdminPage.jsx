import { Workspace } from './StaffPage.jsx';

// Administrators and the super admin use the same tabs as staff, in their own
// workspace. The server's role checks remain the real protection.
export default function AdminPage() {
  return <Workspace area="admin" />;
}
