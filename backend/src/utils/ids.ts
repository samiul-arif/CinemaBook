import { nanoid } from 'nanoid';

export function newBookingRef(): string {
  return `bk_${nanoid(12)}`;
}

export function newOtpRef(): string {
  return `otp_${nanoid(10)}`;
}
