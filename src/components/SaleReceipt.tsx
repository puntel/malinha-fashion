import { useRef } from 'react';
import { Printer, X, ShoppingBag, Store, User, Calendar, CreditCard, Tag, Package, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export interface ReceiptProduct {
  code: string;
  description: string;
  size?: string;
  quantity: number;
  unitPrice: number;
}

export interface ReceiptData {
  // Empresa / Vendedor
  storeName: string;
  storeCnpj?: string;
  storePhone?: string;
  sellerName?: string;

  // Comprador
  buyerName: string;
  buyerCpf?: string;
  buyerPhone?: string;
  buyerAddress?: string;

  // Venda
  receiptNumber?: string;
  saleDate: string;
  paymentMethod?: string;
  products: ReceiptProduct[];
  discount?: number;
  notes?: string;
}

interface SaleReceiptProps {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
}

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function SaleReceipt({ open, onClose, data }: SaleReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const subtotal = data.products.reduce(
    (sum, p) => sum + p.unitPrice * p.quantity,
    0
  );
  const discount = data.discount ?? 0;
  const total = subtotal - discount;
  const totalQty = data.products.reduce((sum, p) => sum + p.quantity, 0);

  const handlePrint = () => {
    const printContents = printRef.current?.innerHTML;
    if (!printContents) return;

    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Recibo – ${data.storeName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #F8EFE2;
            color: #2B1B33;
            font-size: 13px;
            line-height: 1.5;
          }
          .receipt-wrap {
            max-width: 680px;
            margin: 0 auto;
            padding: 32px 28px;
            background: #FBF5EB;
          }

          /* Header */
          .receipt-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 18px;
            border-bottom: 2px solid #5E2A84;
            margin-bottom: 20px;
          }
          .store-brand h1 {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #3D1A5C;
          }
          .store-brand p { font-size: 11px; color: #5E2A84; margin-top: 2px; }
          .receipt-meta { text-align: right; }
          .receipt-meta .receipt-title {
            font-size: 15px;
            font-weight: 700;
            color: #5E2A84;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .receipt-meta p { font-size: 11px; color: #A87BC9; margin-top: 3px; }

          /* Parties */
          .parties-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 22px;
          }
          .party-box {
            background: #F8EFE2;
            border: 1px solid #E2D6C6;
            border-radius: 8px;
            padding: 12px 14px;
          }
          .party-box h3 {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #5E2A84;
            margin-bottom: 8px;
          }
          .party-box p { font-size: 12px; margin-bottom: 3px; color: #2B1B33; }
          .party-box .name { font-size: 14px; font-weight: 700; margin-bottom: 5px; color: #3D1A5C; }

          /* Table */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          thead th {
            background: #3D1A5C;
            color: #FBF5EB;
            padding: 8px 10px;
            text-align: left;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.3px;
          }
          thead th:last-child, thead th:nth-last-child(2), thead th:nth-last-child(3) {
            text-align: right;
          }
          tbody tr:nth-child(even) { background: #F8EFE2; }
          tbody tr:nth-child(odd) { background: #FBF5EB; }
          tbody td {
            padding: 8px 10px;
            font-size: 12px;
            border-bottom: 1px solid #E2D6C6;
            vertical-align: middle;
            color: #2B1B33;
          }
          tbody td:last-child, tbody td:nth-last-child(2), tbody td:nth-last-child(3) {
            text-align: right;
          }
          .code-cell { font-weight: 700; color: #3D1A5C; }
          .size-badge {
            display: inline-block;
            background: #EAE0D2;
            color: #5E2A84;
            border-radius: 4px;
            padding: 1px 6px;
            font-size: 10px;
            font-weight: 600;
            margin-left: 6px;
          }

          /* Totals */
          .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 20px;
          }
          .totals-box {
            min-width: 240px;
            border: 1px solid #E2D6C6;
            border-radius: 8px;
            overflow: hidden;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 14px;
            font-size: 12px;
            background: #FBF5EB;
          }
          .totals-row:not(:last-child) { border-bottom: 1px solid #E2D6C6; }
          .totals-row.total-final {
            background: #3D1A5C;
            color: #FBF5EB;
            font-size: 14px;
            font-weight: 700;
          }
          .totals-row.discount-row { color: #059669; }

          /* Payment & notes */
          .bottom-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
          }
          .info-box {
            border: 1px solid #E2D6C6;
            border-radius: 8px;
            padding: 10px 14px;
            background: #FBF5EB;
          }
          .info-box h4 {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #5E2A84;
            margin-bottom: 6px;
          }
          .info-box p { font-size: 12px; color: #2B1B33; }
          .payment-badge {
            display: inline-block;
            background: #EAE0D2;
            color: #3D1A5C;
            border-radius: 6px;
            padding: 4px 12px;
            font-size: 13px;
            font-weight: 700;
          }

          /* Footer */
          .receipt-footer {
            border-top: 1px dashed #E2D6C6;
            padding-top: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .receipt-footer p { font-size: 10px; color: #A87BC9; }
          .footer-brand { font-size: 10px; color: #5E2A84; font-weight: 700; }

          @media print {
            body { background: #FBF5EB; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-wrap">
          ${printContents}
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  const paymentMethodLabel = data.paymentMethod ?? 'Não informado';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-card">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm text-foreground">Recibo de Venda</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable preview */}
        <div className="overflow-y-auto max-h-[78vh] p-6" style={{ background: '#F8EFE2' }}>
          {/* The printable content */}
          <div
            ref={printRef}
            className="rounded-xl shadow-sm p-7 space-y-5"
            style={{ background: '#FBF5EB', border: '1px solid #E2D6C6', color: '#2B1B33' }}
          >
            {/* ── Header ── */}
            <div className="flex items-start justify-between pb-4" style={{ borderBottom: '2px solid #5E2A84' }}>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: '#3D1A5C' }}>
                  {data.storeName}
                </h1>
                {data.storeCnpj && (
                  <p className="text-[11px] mt-0.5" style={{ color: '#5E2A84' }}>CNPJ: {data.storeCnpj}</p>
                )}
                {data.storePhone && (
                  <p className="text-[11px]" style={{ color: '#5E2A84' }}>Tel: {data.storePhone}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold uppercase tracking-wider" style={{ color: '#5E2A84' }}>Recibo de Venda</p>
                {data.receiptNumber && (
                  <p className="text-[11px] mt-0.5" style={{ color: '#A87BC9' }}>Nº {data.receiptNumber}</p>
                )}
                <p className="text-[11px] mt-1" style={{ color: '#A87BC9' }}>
                  {new Date(data.saleDate).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'long', year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* ── Parties ── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Vendedor */}
              <div className="rounded-lg p-3 space-y-1" style={{ background: '#F8EFE2', border: '1px solid #E2D6C6' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Store className="h-3.5 w-3.5" style={{ color: '#5E2A84' }} />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#5E2A84' }}>Vendedor</h3>
                </div>
                <p className="text-sm font-bold" style={{ color: '#3D1A5C' }}>{data.storeName}</p>
                {data.sellerName && <p className="text-xs" style={{ color: '#2B1B33' }}>Atendente: {data.sellerName}</p>}
                {data.storeCnpj && <p className="text-xs" style={{ color: '#A87BC9' }}>CNPJ: {data.storeCnpj}</p>}
                {data.storePhone && <p className="text-xs" style={{ color: '#A87BC9' }}>Tel: {data.storePhone}</p>}
              </div>

              {/* Comprador */}
              <div className="rounded-lg p-3 space-y-1" style={{ background: '#F8EFE2', border: '1px solid #E2D6C6' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <User className="h-3.5 w-3.5" style={{ color: '#5E2A84' }} />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#5E2A84' }}>Comprador</h3>
                </div>
                <p className="text-sm font-bold" style={{ color: '#3D1A5C' }}>{data.buyerName}</p>
                {data.buyerCpf && <p className="text-xs" style={{ color: '#A87BC9' }}>CPF: {data.buyerCpf}</p>}
                {data.buyerPhone && <p className="text-xs" style={{ color: '#A87BC9' }}>Tel: {data.buyerPhone}</p>}
                {data.buyerAddress && <p className="text-xs" style={{ color: '#A87BC9' }}>Endereço: {data.buyerAddress}</p>}
              </div>
            </div>

            {/* ── Products Table ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4" style={{ color: '#5E2A84' }} />
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#3D1A5C' }}>Itens</h3>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: '#3D1A5C', color: '#FBF5EB' }}>
                    <th className="py-2 px-3 text-left text-[11px] font-semibold tracking-wide rounded-tl-lg">Código / Produto</th>
                    <th className="py-2 px-3 text-center text-[11px] font-semibold tracking-wide">Tam.</th>
                    <th className="py-2 px-3 text-right text-[11px] font-semibold tracking-wide">Qtd</th>
                    <th className="py-2 px-3 text-right text-[11px] font-semibold tracking-wide">Unit.</th>
                    <th className="py-2 px-3 text-right text-[11px] font-semibold tracking-wide rounded-tr-lg">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p, i) => (
                    <tr key={i} style={{ background: i % 2 === 1 ? '#F8EFE2' : '#FBF5EB' }}>
                      <td className="py-2 px-3" style={{ borderBottom: '1px solid #E2D6C6' }}>
                        <span className="font-semibold" style={{ color: '#3D1A5C' }}>{p.code}</span>
                        {p.description && p.description !== p.code && (
                          <span className="text-xs ml-1" style={{ color: '#A87BC9' }}>· {p.description}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center" style={{ borderBottom: '1px solid #E2D6C6' }}>
                        {p.size ? (
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: '#EAE0D2', color: '#5E2A84' }}>
                            {p.size}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-medium" style={{ borderBottom: '1px solid #E2D6C6', color: '#2B1B33' }}>{p.quantity}</td>
                      <td className="py-2 px-3 text-right" style={{ borderBottom: '1px solid #E2D6C6', color: '#A87BC9' }}>
                        {formatBRL(p.unitPrice)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold" style={{ borderBottom: '1px solid #E2D6C6', color: '#2B1B33' }}>
                        {formatBRL(p.unitPrice * p.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Totals ── */}
            <div className="flex justify-end">
              <div className="min-w-[220px] rounded-lg overflow-hidden" style={{ border: '1px solid #E2D6C6' }}>
                <div className="flex justify-between px-4 py-2 text-sm" style={{ borderBottom: '1px solid #E2D6C6', background: '#FBF5EB' }}>
                  <span style={{ color: '#A87BC9' }}>Subtotal ({totalQty} {totalQty === 1 ? 'item' : 'itens'})</span>
                  <span className="font-medium" style={{ color: '#2B1B33' }}>{formatBRL(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between px-4 py-2 text-sm" style={{ borderBottom: '1px solid #E2D6C6', background: '#FBF5EB', color: '#059669' }}>
                    <span>Desconto</span>
                    <span className="font-medium">− {formatBRL(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-2.5" style={{ background: '#3D1A5C', color: '#FBF5EB' }}>
                  <span className="font-bold text-sm">TOTAL</span>
                  <span className="font-extrabold text-base">{formatBRL(total)}</span>
                </div>
              </div>
            </div>

            {/* ── Payment & Notes ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg p-3" style={{ border: '1px solid #E2D6C6', background: '#FBF5EB' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <CreditCard className="h-3.5 w-3.5" style={{ color: '#5E2A84' }} />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#5E2A84' }}>Pagamento</h4>
                </div>
                <span className="inline-block px-3 py-1 rounded text-sm font-bold" style={{ background: '#EAE0D2', color: '#3D1A5C' }}>
                  {paymentMethodLabel}
                </span>
              </div>
              <div className="rounded-lg p-3" style={{ border: '1px solid #E2D6C6', background: '#FBF5EB' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar className="h-3.5 w-3.5" style={{ color: '#5E2A84' }} />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#5E2A84' }}>Data da Venda</h4>
                </div>
                <p className="text-sm font-medium" style={{ color: '#2B1B33' }}>
                  {new Date(data.saleDate).toLocaleDateString('pt-BR', {
                    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {data.notes && (
              <div className="rounded-lg p-3" style={{ border: '1px solid #E2D6C6', background: '#FBF5EB' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="h-3.5 w-3.5" style={{ color: '#5E2A84' }} />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#5E2A84' }}>Observações</h4>
                </div>
                <p className="text-xs whitespace-pre-wrap" style={{ color: '#2B1B33' }}>{data.notes}</p>
              </div>
            )}

            {/* ── Footer ── */}
            <div className="pt-4 flex justify-between items-center" style={{ borderTop: '1px dashed #E2D6C6' }}>
              <div>
                <p className="text-[10px]" style={{ color: '#A87BC9' }}>
                  Documento gerado em {new Date().toLocaleString('pt-BR')}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#A87BC9' }}>
                  Este recibo não possui valor fiscal.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold" style={{ color: '#5E2A84' }}>Malinha Fashion · BagSync</p>
                <p className="text-[10px]" style={{ color: '#A87BC9' }}>Obrigada pela compra! 🛍️</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────────────────────────────────────
   Helper: build ReceiptData from a Sale + Loja info
   ───────────────────────────────────────────────────────── */
export interface BuildReceiptFromSaleOptions {
  sale: {
    id: string;
    product_name: string;
    internal_code?: string | null;
    quantity: number;
    value: number;
    discount?: number | null;
    payment_method?: string | null;
    created_at: string;
    cliente?: { name: string } | null;
    vendedora?: { full_name: string } | null;
  };
  storeName: string;
  storeCnpj?: string;
  storePhone?: string;
  buyerCpf?: string;
  buyerPhone?: string;
  buyerAddress?: string;
}

export function buildReceiptFromSale(opts: BuildReceiptFromSaleOptions): ReceiptData {
  const { sale, storeName, storeCnpj, storePhone, buyerCpf, buyerPhone, buyerAddress } = opts;
  const unitPrice = sale.value / (sale.quantity || 1);

  return {
    storeName,
    storeCnpj,
    storePhone,
    sellerName: sale.vendedora?.full_name,
    buyerName: sale.cliente?.name ?? 'Cliente Avulso',
    buyerCpf,
    buyerPhone,
    buyerAddress,
    receiptNumber: sale.id.slice(0, 8).toUpperCase(),
    saleDate: sale.created_at,
    paymentMethod: sale.payment_method ?? undefined,
    products: [
      {
        code: sale.internal_code ?? sale.product_name,
        description: sale.product_name,
        quantity: sale.quantity,
        unitPrice,
      },
    ],
    discount: sale.discount ?? 0,
  };
}

/* ─────────────────────────────────────────────────────────
   Helper: build ReceiptData from a Malinha
   ───────────────────────────────────────────────────────── */
export interface BuildReceiptFromMalinhaOptions {
  malinha: {
    id: string;
    client_name: string;
    client_cpf?: string;
    client_phone?: string;
    client_address?: string | null;
    seller_note?: string | null;
    created_at: string;
    updated_at: string;
    seller_name?: string;
    malinha_products?: Array<{
      code: string;
      size: string;
      quantity: number;
      price: number;
      status: string;
    }>;
  };
  storeName: string;
  storeCnpj?: string;
  storePhone?: string;
  paymentMethod?: string;
}

export function buildReceiptFromMalinha(opts: BuildReceiptFromMalinhaOptions): ReceiptData {
  const { malinha, storeName, storeCnpj, storePhone, paymentMethod } = opts;

  const soldProducts = (malinha.malinha_products ?? []).filter(
    (p) => p.status === 'accepted' || p.status === 'edited'
  );

  return {
    storeName,
    storeCnpj,
    storePhone,
    sellerName: malinha.seller_name,
    buyerName: malinha.client_name,
    buyerCpf: malinha.client_cpf,
    buyerPhone: malinha.client_phone,
    buyerAddress: malinha.client_address ?? undefined,
    receiptNumber: malinha.id.slice(0, 8).toUpperCase(),
    saleDate: malinha.updated_at ?? malinha.created_at,
    paymentMethod,
    notes: malinha.seller_note ?? undefined,
    products: soldProducts.map((p) => ({
      code: p.code,
      description: p.code,
      size: p.size,
      quantity: p.quantity,
      unitPrice: Number(p.price),
    })),
  };
}
