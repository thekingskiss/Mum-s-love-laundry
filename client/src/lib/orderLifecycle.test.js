import { describe, it, expect } from 'vitest';
import { getAllowedTransitions, milestoneProgress, CUSTOMER_CANCELLABLE_STATUSES } from './orderLifecycle';

describe('orderLifecycle (client)', () => {
  it('lists next steps a staff role can take from order_received', () => {
    expect(getAllowedTransitions('order_received', 'laundry_staff')).toEqual(['in_washing']);
  });

  it('includes cancellation for an admin role from order_received', () => {
    expect(getAllowedTransitions('order_received', 'administrator')).toEqual(
      expect.arrayContaining(['in_washing', 'cancelled'])
    );
  });

  it('returns no next steps for a customer role', () => {
    expect(getAllowedTransitions('order_received', 'customer')).toEqual([]);
  });

  it('returns no next steps from a terminal status', () => {
    expect(getAllowedTransitions('completed', 'super_admin')).toEqual([]);
  });

  it('computes milestone progress along the happy path', () => {
    expect(milestoneProgress('order_received')).toBe(0);
    expect(milestoneProgress('ready_for_pickup')).toBe(4);
    expect(milestoneProgress('completed')).toBe(5);
  });

  it('reports -1 progress for a cancelled order', () => {
    expect(milestoneProgress('cancelled')).toBe(-1);
  });

  it('only allows customer self-cancellation while order_received', () => {
    expect(CUSTOMER_CANCELLABLE_STATUSES).toEqual(['order_received']);
  });
});
