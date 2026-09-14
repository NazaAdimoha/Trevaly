#!/usr/bin/env python3
"""
Wrap the design brief (which is authored as an Artifact fragment — no <html>,
<head> or <body>) into a standalone document suitable for printing and for
conversion to .docx, then leave it beside the source for the export commands.

Run:  python3 docs/design/build-brief-exports.py
"""

from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'marketing-and-storefront-brief.html'
PRINT_OUT = HERE / '.build' / 'brief-print.html'

# Print overrides. The screen design uses a sticky contents rail and a
# theme-aware palette; on paper we want one column, the light palette pinned
# (a PDF must not come out with a dark ground because the exporting machine
# happened to be in dark mode), and no card split across a page boundary.
PRINT_CSS = """
@page { size: A4; margin: 18mm 15mm 20mm; }

@media print {
  html, body { background: #FFFFFF !important; }

  /* Backgrounds carry meaning here — status chips, the tenant-colour
     swatches, table headers — so they must survive the print pipeline. */
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

  .rail { display: none !important; }
  .wrap { display: block !important; max-width: none !important; padding: 0 !important; }
  .masthead { padding-top: 0 !important; }

  .doc > section { break-inside: auto; }
  .doc > section + section { margin-top: 40px !important; }

  h1, h2, h3, h4 { break-after: avoid; }
  .doc h2 { break-before: auto; }

  .note, .spec, .state, .demo, .swatch, .table-scroll { break-inside: avoid; }

  /* On screen the swatches reflow responsively; on a fixed A4 column that
     leaves a 4+1 wrap with a dead half-row. Pin all five to one line. */
  .demo-grid { grid-template-columns: repeat(5, 1fr) !important; }
  .swatch { padding: 12px 10px 14px !important; }
  .swatch-hex { font-size: 10px !important; }
  tr, li { break-inside: avoid; }

  .table-scroll { overflow-x: visible !important; }
  table { font-size: 11.5px; }
  tbody td { padding: 9px 12px; }
  thead th { padding: 9px 12px; }

  body { font-size: 12.5px; line-height: 1.5; }
  .doc p, .doc ul, .doc ol { max-width: none; }
  .standfirst { font-size: 14px; }
  .lede { font-size: 13.5px; }
  .masthead h1 { font-size: 34px; }

  a.inline { text-decoration: underline; }
}
"""

SKELETON = """<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
{head}
<style>{print_css}</style>
</head>
<body>
{body}
</body>
</html>
"""


def extract_block(html: str, opening: str) -> tuple[int, int]:
    """Return the (start, end) span of a <div> block, counting nested divs."""
    start = html.index(opening)
    i, depth = start, 0
    while True:
        nxt_open = html.find('<div', i)
        nxt_close = html.find('</div>', i)
        if nxt_close == -1:
            raise ValueError('unbalanced markup')
        if nxt_open != -1 and nxt_open < nxt_close:
            depth += 1
            i = nxt_open + 4
        else:
            depth -= 1
            i = nxt_close + 6
            if depth == 0:
                return start, i


def main() -> None:
    raw = SOURCE.read_text(encoding='utf-8')

    # The fragment opens with <title> and <style>; everything from the first
    # <div class="wrap"> onward is body content.
    split_at = raw.index('<div class="wrap">')
    head, body = raw[:split_at], raw[split_at:]

    PRINT_OUT.parent.mkdir(parents=True, exist_ok=True)
    PRINT_OUT.write_text(
        SKELETON.format(head=head.strip(), print_css=PRINT_CSS, body=body.strip()),
        encoding='utf-8',
    )
    print(f'wrote {PRINT_OUT}')

    # ── Word path ────────────────────────────────────────────────────────
    # Word carries no CSS from this document, so the tenant-colour swatches —
    # whose entire point is that two of the five are unreadable — would arrive
    # as five identical lines of text. Render that block to a PNG separately
    # and splice the image in instead.
    demo_start, demo_end = extract_block(body, '<div class="demo">')
    demo_html = body[demo_start:demo_end]

    demo_page = SKELETON.format(
        head=head.strip(),
        print_css='body{background:#fff;padding:20px;}'
                  '.demo{margin:0;}'
                  '.demo-grid{grid-template-columns:repeat(5,1fr);}',
        body=f'<div class="wrap"><div class="doc">{demo_html}</div></div>',
    )
    (PRINT_OUT.parent / 'swatch-demo.html').write_text(demo_page, encoding='utf-8')

    docx_body = body[:demo_start] + (
        '<p><img src="swatch-demo.png" alt="The same component rendered in five '
        'tenant colours; the last two produce unreadable white text." '
        'width="620" /></p>'
    ) + body[demo_end:]

    # The sticky contents rail is a screen affordance; Word gets a generated
    # table of contents instead. <nav> is never nested here, so a plain
    # close-tag search is correct (and the div-counting helper is not).
    rail_start = docx_body.index('<nav class="rail"')
    rail_end = docx_body.index('</nav>', rail_start) + len('</nav>')
    docx_body = docx_body[:rail_start] + docx_body[rail_end:]

    (PRINT_OUT.parent / 'brief-docx.html').write_text(
        SKELETON.format(head=head.strip(), print_css='', body=docx_body),
        encoding='utf-8',
    )
    print(f'wrote {PRINT_OUT.parent / "brief-docx.html"}')


if __name__ == '__main__':
    main()
