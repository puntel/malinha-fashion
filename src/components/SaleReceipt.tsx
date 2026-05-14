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
            background: #fff;
            color: #111;
            font-size: 13px;
            line-height: 1.5;
          }
          .receipt-wrap {
            max-width: 680px;
            margin: 0 auto;
            padding: 32px 28px;
          }

          /* Header */
          .receipt-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 18px;
            border-bottom: 2px solid #111;
            margin-bottom: 20px;
          }
          .store-brand h1 {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
          }
          .store-brand p { font-size: 11px; color: #555; margin-top: 2px; }
          .receipt-meta { text-align: right; }
          .receipt-meta .receipt-title {
            font-size: 15px;
            font-weight: 700;
            color: #7c3aed;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .receipt-meta p { font-size: 11px; color: #555; margin-top: 3px; }

          /* Parties */
          .parties-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 22px;
          }
          .party-box {
            background: #f9f9f9;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            padding: 12px 14px;
          }
          .party-box h3 {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #7c3aed;
            margin-bottom: 8px;
          }
          .party-box p { font-size: 12px; margin-bottom: 3px; }
          .party-box .name { font-size: 14px; font-weight: 700; margin-bottom: 5px; }

          /* Table */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          thead th {
            background: #111;
            color: #fff;
            padding: 8px 10px;
            text-align: left;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.3px;
          }
          thead th:last-child, thead th:nth-last-child(2), thead th:nth-last-child(3) {
            text-align: right;
          }
          tbody tr:nth-child(even) { background: #f6f6f6; }
          tbody td {
            padding: 8px 10px;
            font-size: 12px;
            border-bottom: 1px solid #eee;
            vertical-align: middle;
          }
          tbody td:last-child, tbody td:nth-last-child(2), tbody td:nth-last-child(3) {
            text-align: right;
          }
          .code-cell { font-weight: 700; }
          .size-badge {
            display: inline-block;
            background: #ede9fe;
            color: #6d28d9;
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
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            overflow: hidden;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 14px;
            font-size: 12px;
          }
          .totals-row:not(:last-child) { border-bottom: 1px solid #eee; }
          .totals-row.total-final {
            background: #111;
            color: #fff;
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
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            padding: 10px 14px;
          }
          .info-box h4 {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #7c3aed;
            margin-bottom: 6px;
          }
          .info-box p { font-size: 12px; }
          .payment-badge {
            display: inline-block;
            background: #ede9fe;
            color: #6d28d9;
            border-radius: 6px;
            padding: 4px 12px;
            font-size: 13px;
            font-weight: 700;
          }

          /* Footer */
          .receipt-footer {
            border-top: 1px dashed #ccc;
            padding-top: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .receipt-footer p { font-size: 10px; color: #888; }
          .footer-brand { font-size: 10px; color: #7c3aed; font-weight: 600; }

          @media print {
            body { background: #fff; }
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
            <span className="font-semibold text-sm">Recibo de Venda</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} size="sm" className="gap-2">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable preview */}
        <div className="overflow-y-auto max-h-[78vh] p-6 bg-gray-50 dark:bg-zinc-900">
          {/* The printable content */}
          <div
            ref={printRef}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-7 space-y-5 text-gray-900"
          >
            {/* ── Header ── */}
            <div className="flex items-start justify-between pb-4 border-b-2 border-gray-900">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
                  {data.storeName}
                </h1>
                {data.storeCnpj && (
                  <p className="text-[11px] text-gray-500 mt-0.5">CNPJ: {data.storeCnpj}</p>
                )}
                {data.storePhone && (
                  <p className="text-[11px] text-gray-500">Tel: {data.storePhone}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-violet-600 uppercase tracking-wider">Recibo de Venda</p>
                {data.receiptNumber && (
                  <p className="text-[11px] text-gray-500 mt-0.5">Nº {data.receiptNumber}</p>
                )}
                <p className="text-[11px] text-gray-500 mt-1">
                  {new Date(data.saleDate).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: 'long', year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* ── Parties ── */}
            <div className="grid grid-cols-2 gap-4">
              {/* Vendedor */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <Store className="h-3.5 w-3.5 text-violet-600" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Vendedor</h3>
                </div>
                <p className="text-sm font-bold text-gray-900">{data.storeName}</p>
                {data.sellerName && <p className="text-xs text-gray-600">Atendente: {data.sellerName}</p>}
                {data.storeCnpj && <p className="text-xs text-gray-500">CNPJ: {data.storeCnpj}</p>}
                {data.storePhone && <p className="text-xs text-gray-500">Tel: {data.storePhone}</p>}
              </div>

              {/* Comprador */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <User className="h-3.5 w-3.5 text-violet-600" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Comprador</h3>
                </div>
                <p className="text-sm font-bold text-gray-900">{data.buyerName}</p>
                {data.buyerCpf && <p className="text-xs text-gray-500">CPF: {data.buyerCpf}</p>}
                {data.buyerPhone && <p className="text-xs text-gray-500">Tel: {data.buyerPhone}</p>}
                {data.buyerAddress && <p className="text-xs text-gray-500">Endereço: {data.buyerAddress}</p>}
              </div>
            </div>

            {/* ── Products Table ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-violet-600" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-700">Itens</h3>
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-900 text-white">
                    <th className="py-2 px-3 text-left text-[11px] font-semibold tracking-wide rounded-tl-lg">Código / Produto</th>
                    <th className="py-2 px-3 text-center text-[11px] font-semibold tracking-wide">Tam.</th>
                    <th className="py-2 px-3 text-right text-[11px] font-semibold tracking-wide">Qtd</th>
                    <th className="py-2 px-3 text-right text-[11px] font-semibold tracking-wide">Unit.</th>
                    <th className="py-2 px-3 text-right text-[11px] font-semibold tracking-wide rounded-tr-lg">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p, i) => (
                    <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-2 px-3 border-b border-gray-100">
                        <span className="font-semibold text-gray-900">{p.code}</span>
                        {p.description && p.description !== p.code && (
                          <span className="text-gray-500 text-xs ml-1">· {p.description}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-center">
                        {p.size ? (
                          <span className="inline-block bg-violet-100 text-violet-700 text-[10px] font-bold px-2 py-0.5 rounded">
                            {p.size}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right font-medium">{p.quantity}</td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right text-gray-600">
                        {formatBRL(p.unitPrice)}
                      </td>
                      <td className="py-2 px-3 border-b border-gray-100 text-right font-semibold">
                        {formatBRL(p.unitPrice * p.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Totals ── */}
            <div className="flex justify-end">
              <div className="min-w-[220px] border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex justify-between px-4 py-2 text-sm border-b border-gray-100">
                  <span className="text-gray-500">Subtotal ({totalQty} {totalQty === 1 ? 'item' : 'itens'})</span>
                  <span className="font-medium">{formatBRL(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between px-4 py-2 text-sm border-b border-gray-100 text-emerald-600">
                    <span>Desconto</span>
                    <span className="font-medium">− {formatBRL(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-2.5 bg-gray-900 text-white">
                  <span className="font-bold text-sm">TOTAL</span>
                  <span className="font-extrabold text-base">{formatBRL(total)}</span>
                </div>
              </div>
            </div>

            {/* ── Payment & Notes ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <CreditCard className="h-3.5 w-3.5 text-violet-600" />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Pagamento</h4>
                </div>
                <span className="inline-block bg-violet-100 text-violet-700 px-3 py-1 rounded text-sm font-bold">
                  {paymentMethodLabel}
                </span>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar className="h-3.5 w-3.5 text-violet-600" />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Data da Venda</h4>
                </div>
                <p className="text-sm font-medium text-gray-700">
                  {new Date(data.saleDate).toLocaleDateString('pt-BR', {
                    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {data.notes && (
              <div className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="h-3.5 w-3.5 text-violet-600" />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Observações</h4>
                </div>
                <p className="text-xs text-gray-600 whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}

            {/* ── Footer ── */}
            <div className="pt-4 border-t border-dashed border-gray-300 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-gray-400">
                  Documento gerado em {new Date().toLocaleString('pt-BR')}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Este recibo não possui valor fiscal.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-violet-600 font-bold">Malinha Fashion · BagSync</p>
                <p className="text-[10px] text-gray-400">Obrigada pela compra! 🛍️</p>
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
