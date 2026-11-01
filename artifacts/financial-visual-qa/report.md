# Financial dashboard visual QA

Status: partial. The financial reference image was not found in the workspace; the existing screenshots depict the operational dashboard. A reference comparison still requires the original image.

## Browser observations

The production page was inspected with read-only source data at 1440, 768 and 390 CSS pixels. The page had no horizontal viewport overflow at these widths. Six KPI cards, shared navigation, responsive filters, chart panels and honest unavailable states were present. After making the KPI grid rows equal, all cards measured 144 px high at desktop and tablet widths and 154 px at mobile width. The application uses an orange accent with light surfaces. Visual matching and the four automated style warnings require comparison against the missing reference.

Screenshots are saved alongside this report as `desktop-1440.png`, `tablet-768.png`, `mobile-390.png` and their `-grafik.png` counterparts. These images contain real dashboard data.

## `0 jt` investigation

The automated inspector flags an offscreen, `aria-hidden` Recharts text-measurement span, `#recharts_measurement_span`, positioned at x=0 and y≈-20000 px. Its text happened to be `0 jt`. The inspector checks the x coordinate without excluding this hidden helper. This is a false positive, not a visible axis label clipping defect; no chart workaround was added.

The real SVG labels stayed in the same position at the first animation frame and after the chart settled (at least 1.8 seconds):

| Viewport | Comparison chart label x | Margin chart label x | Responsive containers |
| --- | ---: | ---: | --- |
| 1440 px | 87.3 px | 127.7 px | 881×210 / 648×210 px |
| 768 px | 87.3 px | 127.7 px | 312×210 / 312×210 px |
| 390 px | 67.3 px | 107.7 px | 336×185 / 336×185 px |

The measured chart margin was top 12, right 20, left 8, bottom 12 px; axis widths were 55 px for the comparison chart and 80 px for the margin chart. Fonts were loaded during measurement. Mobile chart animation was active initially and completed by the later measurement. Detailed geometry is retained in `axis-measurements.json`.

## Validation

- ESLint, TypeScript and production build with Webpack passed.
- Automated tests: 74 passed.
- Browser visual and geometry checks completed for all three widths.
- A later attempt to repeat the separate filter interaction smoke test could not run because the sandbox denied binding a local server; that repeat remains unverified.
- No source, calculation, filter semantics or Google Sheets integration was changed in this QA edit.
