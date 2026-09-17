import * as Yup from 'yup';

import { DeliveryMethod } from '@core/enums';

export interface ICheckoutFormValues {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  deliveryZoneId: string;
  deliveryAddress: string;
  couponCode: string;
}

export const checkoutInitialValues: ICheckoutFormValues = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  deliveryMethod: DeliveryMethod.ZONE_DELIVERY,
  deliveryZoneId: '',
  deliveryAddress: '',
  couponCode: '',
};

/**
 * Mirrors `checkoutSchema` (Zod) on the server. Both exist deliberately: this
 * one gives the customer immediate feedback, the server one is the guard. If
 * they ever disagree the server wins, and nothing here is trusted.
 */
export const checkoutValidationSchema = Yup.object({
  customerName: Yup.string()
    .trim()
    .min(2, 'Too short')
    .required('Name is required'),
  customerEmail: Yup.string()
    .trim()
    .email('Enter a valid email')
    .required('Email is required'),
  customerPhone: Yup.string()
    .trim()
    .matches(/^(\+?234|0)[789]\d{9}$/, 'Enter a valid Nigerian phone number')
    .required('Phone number is required'),
  deliveryMethod: Yup.string()
    .oneOf(Object.values(DeliveryMethod))
    .required('Choose a delivery method'),
  deliveryZoneId: Yup.string().when('deliveryMethod', {
    is: DeliveryMethod.ZONE_DELIVERY,
    then: (schema) => schema.required('Select a delivery zone'),
    otherwise: (schema) => schema.strip(),
  }),
  deliveryAddress: Yup.string().when('deliveryMethod', {
    is: DeliveryMethod.ZONE_DELIVERY,
    then: (schema) =>
      schema
        .trim()
        .min(5, 'Enter a full address')
        .required('Address is required'),
    otherwise: (schema) => schema.strip(),
  }),
  couponCode: Yup.string().trim().max(40),
});
