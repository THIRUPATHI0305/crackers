/** Shared print CSS for A4 vs 55mm thermal bill/invoice receipts. */
export function billPrintCss(opts: {
  rootId: string;
  mode: "a4" | "thermal" | null;
}) {
  const { rootId, mode } = opts;
  const page =
    mode === "thermal"
      ? "size: 55mm auto; margin: 1.5mm;"
      : "size: A4; margin: 12mm;";

  return `
@media print {
  @page { ${page} }
  html, body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  body * { visibility: hidden !important; }
  #${rootId}, #${rootId} * { visibility: visible !important; }
  #${rootId} {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    background: white !important;
    color: #000 !important;
  }
  #${rootId}.receipt-thermal-55 {
    width: 52mm !important;
    max-width: 52mm !important;
    padding: 1mm !important;
    font-size: 9px !important;
    line-height: 1.25 !important;
  }
  #${rootId}.receipt-thermal-55 table {
    font-size: 8.5px !important;
  }
  #${rootId}.receipt-thermal-55 .receipt-title {
    font-size: 11px !important;
  }
  #${rootId}.receipt-thermal-55 .receipt-total {
    font-size: 11px !important;
  }
  #${rootId}.receipt-a4 {
    width: 100% !important;
    max-width: 190mm !important;
    padding: 0 !important;
  }
}
`;
}
