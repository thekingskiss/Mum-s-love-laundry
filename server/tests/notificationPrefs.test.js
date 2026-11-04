import { describe, it, expect } from 'vitest';
import { outboundChannels } from '../utils/notificationPrefs';

describe('outboundChannels', () => {
  it('sends everything when preferences are on or missing', () => {
    expect(outboundChannels('order_status', { email_order_updates: true, sms_order_updates: true })).toEqual({ email: true, sms: true });
    expect(outboundChannels('order_status', undefined)).toEqual({ email: true, sms: true });
  });

  it('controls order-update email and SMS separately', () => {
    expect(outboundChannels('order_status', { email_order_updates: false, sms_order_updates: true })).toEqual({ email: false, sms: true });
    expect(outboundChannels('order_status', { email_order_updates: true, sms_order_updates: false })).toEqual({ email: true, sms: false });
  });

  it('applies the single-switch preferences to both channels', () => {
    const off = { email: false, sms: false };
    expect(outboundChannels('pickup_reminder', { pickup_reminders: false })).toEqual(off);
    expect(outboundChannels('invoice', { invoice_notifications: false })).toEqual(off);
    expect(outboundChannels('invoice_reminder', { invoice_notifications: false })).toEqual(off);
    expect(outboundChannels('low_stock', { low_stock_alerts: false })).toEqual(off);
  });

  it('does not let another setting silence a type it does not cover', () => {
    const allOff = {
      email_order_updates: false,
      sms_order_updates: false,
      pickup_reminders: false,
      invoice_notifications: false,
      low_stock_alerts: false,
    };
    expect(outboundChannels('payment', allOff)).toEqual({ email: true, sms: true });
    expect(outboundChannels('admin_message', allOff)).toEqual({ email: true, sms: true });
  });
});
