import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getAllowedTransitions,
  isStaffRole,
  isAdminRole,
  CUSTOMER_CANCELLABLE_STATUSES,
} from '../config/orderLifecycle';

describe('orderLifecycle', () => {
  it('allows staff to move an order from order_received to in_washing', () => {
    expect(canTransition('order_received', 'in_washing', 'laundry_staff')).toBe(true);
  });

  it('does not allow laundry_staff to cancel an order', () => {
    expect(canTransition('order_received', 'cancelled', 'laundry_staff')).toBe(false);
  });

  it('allows an administrator to cancel an order', () => {
    expect(canTransition('order_received', 'cancelled', 'administrator')).toBe(true);
  });

  it('rejects transitions that skip a stage', () => {
    expect(canTransition('order_received', 'quality_check', 'super_admin')).toBe(false);
  });

  it('rejects any transition out of a terminal status', () => {
    expect(canTransition('completed', 'ready_for_pickup', 'super_admin')).toBe(false);
    expect(canTransition('cancelled', 'order_received', 'super_admin')).toBe(false);
  });

  it('rejects an unknown role', () => {
    expect(canTransition('order_received', 'in_washing', 'customer')).toBe(false);
  });

  it('lists the next possible statuses for a given status', () => {
    expect(getAllowedTransitions('order_received')).toEqual(['in_washing', 'cancelled']);
    expect(getAllowedTransitions('completed')).toEqual([]);
  });

  it('identifies staff and admin roles correctly', () => {
    expect(isStaffRole('laundry_staff')).toBe(true);
    expect(isStaffRole('customer')).toBe(false);
    expect(isAdminRole('administrator')).toBe(true);
    expect(isAdminRole('laundry_staff')).toBe(false);
  });

  it('only allows customer self-cancellation while order_received', () => {
    expect(CUSTOMER_CANCELLABLE_STATUSES).toEqual(['order_received']);
  });
});
