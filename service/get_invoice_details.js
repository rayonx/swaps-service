const asyncAuto = require('async/auto');
const asyncConstant = require('async/constant');
const {decode} = require('bolt11');

const getPrice = require('./get_price');
const {returnResult} = require('./../async-util');

/** Get invoice details

  {
    invoice: <Invoice String>
  }

  @returns via cbk
  {
    created_at: <Created At ISO 8601 Date String>
    currency: <Currency Code String>
    description: <Payment Description String>
    [destination_label]: <Destination Label String>
    [destination_url]: <Destination Url String>
    [expires_at]: <Expires At ISO 8601 Date String>
    [fiat_currency_code]: <Fiat Currency Code String>
    [fiat_value]: <Fiat Value in Cents Number>
    id: <Invoice Id String>
    is_testnet: <Is Testnet Bool>
    tokens: <Tokens to Send Number>
  }
*/
module.exports = ({invoice}, cbk) => {
  return asyncAuto({
    // Assumed currency code
    currency: asyncConstant('BTC'),

    // Fiat currency
    fiatCurrency: asyncConstant('USD'),

    // Decode the supplied invoice
    invoice: cbk => {
      try {
        return cbk(null, decode(invoice));
      } catch (e) {
        return cbk([400, 'DecodeAddressFailure', e]);
      }
    },

    // Grab the fiat price
    getPrice: ['currency', 'fiatCurrency', ({currency, fiatCurrency}, cbk) => {
      return getPrice({
        from_currency_code: currency,
        to_currency_code: fiatCurrency,
      },
      cbk);
    }],

    // Check that the supplied invoice is payable
    checkInvoice: ['invoice', ({invoice}, cbk) => {
      if (!invoice.complete) {
        return cbk([400, 'InvoiceNotComplete']);
      }

      if (!invoice.satoshis) {
        return cbk([400, 'InvoiceMissingTokens']);
      }

      return cbk();
    }],

    // Invoice description
    description: ['invoice', ({invoice}, cbk) => {
      const description = invoice.tags.find(t => t.tagName === 'description');

      if (!description) {
        return cbk(null, '');
      }

      return cbk(null, description.data);
    }],

    id: ['invoice', ({invoice}, cbk) => {
      const id = invoice.tags.find(t => t.tagName === 'payment_hash');

      if (!id || !id.data) {
        return cbk([500, 'InvoiceDecodingFailure']);
      }

      return cbk(null, id.data);
    }],

    // Fiat value
    fiatValue: ['getPrice', 'invoice', ({getPrice, invoice}, cbk) => {
      if (!getPrice.quote) {
        return cbk();
      }

      return cbk(null, Math.round(getPrice.quote * invoice.satoshis / 1e8));
    }],

    // Invoice Details
    invoiceDetails: [
      'currency',
      'description',
      'fiatCurrency',
      'fiatValue',
      'id',
      'invoice',
      (res, cbk) =>
    {
      return cbk(null, {
        created_at: res.invoice.timestampString,
        currency: res.currency,
        description: res.description,
        destination_label: null,
        destination_public_key: res.invoice.payeeNodeKey,
        destination_url: null,
        expires_at: res.invoice.timeExpireDateString || null,
        fiat_currency_code: res.fiatCurrency,
        fiat_value: res.fiatValue || null,
        id: res.id,
        is_testnet: res.invoice.coinType === 'testnet',
        tokens: res.invoice.satoshis,
      });
    }],
  },
  returnResult({of: 'invoiceDetails'}, cbk));
};

