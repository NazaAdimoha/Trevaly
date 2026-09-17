/**
 * The card marks a shopper looks for before typing a card number.
 *
 * Drawn as small inline SVG wordmarks rather than fetched images: six logo
 * files on every page is six requests for reassurance, and a broken image in
 * the trust row does the opposite of reassure. Paystack settles all of these,
 * so the row is honest.
 */
const MARKS = [
  { label: 'Visa', text: 'VISA', bg: '#1434CB', color: '#FFFFFF', width: 44 },
  { label: 'Mastercard', text: 'MC', bg: '#EB001B', color: '#FFFFFF', width: 40 },
  { label: 'Verve', text: 'VERVE', bg: '#0C7C3C', color: '#FFFFFF', width: 50 },
  { label: 'Bank transfer', text: 'BANK', bg: '#111827', color: '#FFFFFF', width: 46 },
  { label: 'USSD', text: 'USSD', bg: '#4B5563', color: '#FFFFFF', width: 46 },
];

export function PaymentIcons() {
  return (
    <ul className='flex flex-wrap items-center gap-2' aria-label='Accepted payment methods'>
      {MARKS.map((mark) => (
        <li key={mark.label}>
          <span
            title={mark.label}
            className='flex h-6 items-center justify-center rounded-[3px] px-2 text-[9px] font-bold tracking-wider'
            style={{ background: mark.bg, color: mark.color, minWidth: mark.width }}
          >
            {mark.text}
            <span className='sr-only'>{mark.label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
