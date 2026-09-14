/**
 * Structured data, rendered server-side.
 *
 * Always derive the `data` object from the same source the page renders from.
 * A JSON-LD block maintained separately from the visible copy drifts, and
 * Google flags the mismatch rather than ignoring it.
 *
 * `JSON.stringify` cannot emit `</script`, but it happily emits `<` and `/`
 * separately, so the escape below is what stops a value containing `</script>`
 * from closing the tag early. Tenant-supplied strings (store names, product
 * descriptions) reach this component, so the escape is load-bearing, not
 * decorative.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type='application/ld+json'

      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
