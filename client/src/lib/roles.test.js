import { describe, it, expect } from 'vitest';
import { workspacePath } from './roles';

describe('workspacePath', () => {
  it.each([
    ['super_admin', '/admin'],
    ['administrator', '/admin'],
    ['laundry_staff', '/staff'],
    ['customer', '/dashboard'],
    [undefined, '/dashboard'],
  ])('sends %s to %s', (role, path) => {
    expect(workspacePath(role)).toBe(path);
  });
});
